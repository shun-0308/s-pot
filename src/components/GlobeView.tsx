"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { geoContains, geoCentroid, geoEquirectangular, geoPath } from "d3-geo";
import { COUNTRIES, JAPAN_CODE, type Country } from "@/lib/world";

type Props = {
  counts: Record<string, number>; // country_code → 記録数
  startFromJapan?: boolean; // 日本地図から戻ってきたとき、日本からズームアウト
  flyToCode?: string | null; // メニューからの指定国へ自動ズーム
  flyToKey?: number;
  onEnterJapan: () => void;
  onEnterCountry: (c: Country) => void;
};

const JP: [number, number] = [138.5, 37];
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const STAR_COLORS = ["#EDE8DC", "#EDE8DC", "#EDE8DC", "#A9C4E8", "#E8C9A0", "#D8A8B8"];
const D2R = Math.PI / 180;

// 緯度経度 → 球面座標(equirectangularテクスチャ準拠)
const v3 = (lat: number, lon: number, r = 1) => {
  const phi = (90 - lat) * D2R;
  const theta = (lon + 180) * D2R;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
};
const localToLatLon = (p: THREE.Vector3): [number, number] => {
  const r = p.length();
  const lat = 90 - Math.acos(p.y / r) / D2R;
  // v3()の逆変換: θ = lon + 180, atan2(x, z) = θ - 90
  const lon = ((((Math.atan2(p.x, p.z) / D2R - 90) % 360) + 540) % 360) - 180;
  return [lon, lat];
};

// 衛星写真の3D地球。ドラッグで回転、国をポイントすると照準線、クリックでズームイン。
export default function GlobeView({ counts, startFromJapan, flyToCode, flyToKey, onEnterJapan, onEnterCountry }: Props) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const countsRef = useRef(counts);
  countsRef.current = counts;
  const cbRef = useRef({ onEnterJapan, onEnterCountry });
  cbRef.current = { onEnterJapan, onEnterCountry };

  useEffect(() => {
    const bg = bgRef.current, gl = glRef.current, hud = hudRef.current, wrap = wrapRef.current;
    if (!bg || !gl || !hud || !wrap) return;
    const bctx = bg.getContext("2d");
    const hctx = hud.getContext("2d");
    if (!bctx || !hctx) return;

    const japan = COUNTRIES.find((c) => c.code === JAPAN_CODE) ?? null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── three.js シーン ──
    const renderer = new THREE.WebGLRenderer({ canvas: gl, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    camera.position.set(0, 0, 3.4);

    // 太陽光(画面右上の太陽と方向を一致させる)。月の陰影用ライト+地球は専用シェーダー
    scene.add(new THREE.AmbientLight(0x8a93a5, 0.5));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.8);
    sun.position.set(1.9, 1.2, 0.6);
    scene.add(sun);
    const sunDirW = sun.position.clone().normalize();

    const loader = new THREE.TextureLoader();
    const texDay = loader.load("/textures/earth-blue-marble.jpg");
    texDay.colorSpace = THREE.SRGBColorSpace;
    const texNight = loader.load("/textures/earth-night.jpg");
    texNight.colorSpace = THREE.SRGBColorSpace;
    const texWater = loader.load("/textures/earth-water.png");

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // 昼夜シェーダー: 太陽の反対側は夜になり、都市の灯りが灯る
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayTex: { value: texDay },
        nightTex: { value: texNight },
        waterTex: { value: texWater },
        sunDir: { value: sunDirW },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vPosW;
        void main() {
          vUv = uv;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTex;
        uniform sampler2D nightTex;
        uniform sampler2D waterTex;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vPosW;
        void main() {
          vec3 n = normalize(vNormalW);
          vec3 viewDir = normalize(cameraPosition - vPosW);
          float cosSun = dot(n, normalize(sunDir));
          float dayI = clamp(cosSun, 0.0, 1.0);
          vec3 day = texture2D(dayTex, vUv).rgb;
          vec3 night = texture2D(nightTex, vUv).rgb;
          float water = texture2D(waterTex, vUv).r;

          // 昼: 太陽が当たる側だけ明るく(夜側はほぼ漆黒 = 真夜中)
          vec3 color = day * (0.012 + 1.35 * dayI);
          // 夜: 都市の灯りだけが浮かぶ(昼夜の境でクロスフェード)
          float nightI = 1.0 - smoothstep(-0.18, 0.12, cosSun);
          vec3 lights = max(night - vec3(0.05), vec3(0.0)); // 夜景テクスチャの青被りを除去
          color += lights * nightI * 1.25;
          // 海面の太陽反射
          vec3 refl = reflect(-normalize(sunDir), n);
          float spec = pow(max(dot(refl, viewDir), 0.0), 22.0) * water * dayI;
          color += vec3(1.0, 0.88, 0.7) * spec * 0.6;
          // 大気の青いフレネル(昼側で強く、夜側はほぼ消える)
          float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.8);
          color += vec3(0.3, 0.5, 0.95) * rim * (0.05 + 0.95 * dayI);

          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), earthMat);
    earthGroup.add(earth);

    // 国ハイライト用オーバーレイ(訪問国=朱・ホバー=光)
    const hlCanvas = document.createElement("canvas");
    hlCanvas.width = 2048; hlCanvas.height = 1024;
    const hlCtx = hlCanvas.getContext("2d")!;
    const eqProj = geoEquirectangular().translate([1024, 512]).scale(2048 / (2 * Math.PI));
    const eqPath = geoPath(eqProj, hlCtx);
    const hlTex = new THREE.CanvasTexture(hlCanvas);
    hlTex.colorSpace = THREE.SRGBColorSpace;
    const hlMat = new THREE.MeshBasicMaterial({ map: hlTex, transparent: true, depthWrite: false });
    const hlSphere = new THREE.Mesh(new THREE.SphereGeometry(1.002, 96, 96), hlMat);
    earthGroup.add(hlSphere);

    let hlDirty = true;
    let lastPaintHover: string | null = null;
    const paintHighlights = (hoverCode: string | null) => {
      hlCtx.clearRect(0, 0, 2048, 1024);
      const cts = countsRef.current;
      for (const c of COUNTRIES) {
        const visited = (cts[c.code] ?? 0) > 0;
        const isHover = hoverCode === c.code;
        if (!visited && !isHover) continue;
        hlCtx.beginPath();
        eqPath(c.feature);
        if (visited) {
          hlCtx.fillStyle = isHover ? "rgba(209,75,48,0.85)" : "rgba(178,58,36,0.78)";
          hlCtx.fill();
          hlCtx.strokeStyle = "rgba(247,245,239,0.9)";
          hlCtx.lineWidth = 1.6;
          hlCtx.stroke();
        } else {
          hlCtx.fillStyle = "rgba(237,232,220,0.3)";
          hlCtx.fill();
          hlCtx.strokeStyle = "rgba(237,232,220,0.95)";
          hlCtx.lineWidth = 1.4;
          hlCtx.stroke();
        }
      }
      hlTex.needsUpdate = true;
    };

    // 大気のフレネル発光(外側スフィア・加算合成。太陽側で強く光る)
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { sunDir: { value: sunDirW } },
      vertexShader: `
        varying vec3 vNormalV;
        varying vec3 vNormalW;
        void main() {
          vNormalV = normalize(normalMatrix * normal);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunDir;
        varying vec3 vNormalV;
        varying vec3 vNormalW;
        void main() {
          float intensity = pow(0.62 - dot(vNormalV, vec3(0.0, 0.0, 1.0)), 2.4);
          float lit = 0.1 + 0.9 * clamp(dot(vNormalW, normalize(sunDir)), 0.0, 1.0);
          gl_FragColor = vec4(vec3(0.32, 0.55, 1.0) * intensity * lit, 1.0);
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.16, 96, 96), atmoMat);
    scene.add(atmo);

    // 月(クレーター入りの手描きテクスチャ+陰影)
    const moonCanvas = document.createElement("canvas");
    moonCanvas.width = 512; moonCanvas.height = 256;
    const mcx = moonCanvas.getContext("2d")!;
    mcx.fillStyle = "#BAB7AC";
    mcx.fillRect(0, 0, 512, 256);
    const rnd = (i: number) => (Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1;
    const ar = (x: number) => Math.abs(rnd(x));
    for (let i = 0; i < 9; i++) {
      // 海(暗い斑)
      mcx.fillStyle = `rgba(118,116,108,${0.25 + ar(i) * 0.2})`;
      mcx.beginPath();
      mcx.ellipse(ar(i * 3 + 1) * 512, ar(i * 7 + 2) * 256, 28 + ar(i * 5) * 60, 20 + ar(i * 11) * 40, ar(i) * 3, 0, 7);
      mcx.fill();
    }
    for (let i = 0; i < 60; i++) {
      const cx = ar(i * 13 + 5) * 512, cy = ar(i * 17 + 9) * 256, cr = 1.5 + ar(i * 23) * 7;
      mcx.fillStyle = `rgba(92,90,84,${0.2 + ar(i * 29) * 0.25})`;
      mcx.beginPath();
      mcx.arc(cx, cy, cr, 0, 7);
      mcx.fill();
      mcx.strokeStyle = "rgba(214,211,200,0.5)";
      mcx.lineWidth = 0.8;
      mcx.beginPath();
      mcx.arc(cx, cy, cr, -2.6, -0.4);
      mcx.stroke();
    }
    const moonTex = new THREE.CanvasTexture(moonCanvas);
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 48, 48),
      new THREE.MeshPhongMaterial({ map: moonTex, bumpMap: moonTex, bumpScale: 1.2, shininess: 2 })
    );
    scene.add(moon);

    // 太陽は画面右上にHUDで描く(光源方向と一致)

    // ── 状態(2D版と同じモデル) ──
    let center: [number, number] = startFromJapan ? [...JP] as [number, number] : [150, 14];
    let zoomMul = startFromJapan ? 7.5 : 1;
    let mode: "free" | "zoomOut" | "zoomIn" = startFromJapan ? "zoomOut" : "free";
    let zoomT0 = performance.now();
    let zoomFrom: [number, number] = [...center] as [number, number];
    let zoomFromMul = zoomMul;
    let target: Country | null = null;
    let targetCenter: [number, number] = JP;
    let targetMul = 8;
    let fired = false;

    let hover: Country | null = null;
    let mouse = { x: -1, y: -1, inside: false };
    let needPick = false;
    let lastPick = 0;
    let dragging = false, downAt = { x: 0, y: 0 }, moved = false;
    let lastInteract = 0;

    const raycaster = new THREE.Raycaster();

    let w = 0, h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = wrap.clientWidth || window.innerWidth;
      h = wrap.clientHeight || window.innerHeight;
      for (const c of [bg, hud]) {
        c.width = w * dpr; c.height = h * dpr;
        c.style.width = `${w}px`; c.style.height = `${h}px`;
      }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // 星空(背景キャンバス)
    const mkStars = (n: number, rMax: number) =>
      Array.from({ length: n }, () => ({
        x: Math.random(), y: Math.random(),
        r: Math.random() * rMax + 0.25,
        a: Math.random() * 0.5 + 0.12,
        tw: Math.random() * Math.PI * 2,
        sp: Math.random() * 0.6 + 0.4,
        c: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      }));
    const starLayers = [
      { stars: mkStars(150, 0.7), k: 0.25 },
      { stars: mkStars(90, 1.1), k: 0.6 },
      { stars: mkStars(40, 1.7), k: 1.1 },
    ];
    let shoot: { x: number; y: number; vx: number; vy: number; t0: number } | null = null;

    const camDist = () => 1.16 + 2.28 / zoomMul;

    const pick = (x: number, y: number): Country | null => {
      raycaster.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), camera);
      const hit = raycaster.intersectObject(earth, false)[0];
      if (!hit) return null;
      const local = earth.worldToLocal(hit.point.clone());
      const ll = localToLatLon(local);
      if (japan && geoContains(japan.feature, ll)) return japan;
      for (const c of COUNTRIES) {
        if (c.code === JAPAN_CODE) continue;
        if (geoContains(c.feature, ll)) return c;
      }
      return null;
    };

    const finish = () => {
      if (fired) return;
      fired = true;
      wrap.style.opacity = "0";
      const t = target;
      window.setTimeout(() => {
        if (t && t.code !== JAPAN_CODE) cbRef.current.onEnterCountry(t);
        else cbRef.current.onEnterJapan();
      }, 560);
    };

    const activate = (c: Country) => {
      if (mode === "zoomIn" || fired) return;
      target = c;
      zoomFrom = [...center] as [number, number];
      zoomFromMul = zoomMul;
      zoomT0 = performance.now();
      if (c.code === JAPAN_CODE) { targetCenter = JP; targetMul = 7.5; }
      else {
        const [lon, lat] = geoCentroid(c.feature);
        targetCenter = [lon, lat];
        targetMul = 2.7;
      }
      if (reduced) { finish(); return; }
      mode = "zoomIn";
      hover = null;
      hlDirty = true;
    };

    // メニューからの自動ズーム
    let flyTimer = 0;
    if (flyToCode) {
      const c = COUNTRIES.find((x) => x.code === flyToCode);
      if (c) flyTimer = window.setTimeout(() => activate(c), 750);
    }

    // ── 入力 ──
    const onPointerDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
      moved = false;
      dragging = true;
      lastInteract = performance.now();
    };
    const onPointerMove = (e: PointerEvent) => {
      mouse = { x: e.clientX, y: e.clientY, inside: true };
      lastInteract = performance.now();
      if (dragging && mode === "free") {
        const dx = e.clientX - downAt.x, dy = e.clientY - downAt.y;
        // タッチは指のブレでドラッグ誤判定されやすいのでしきい値を広げる
        const slop = e.pointerType === "touch" ? 14 : 5;
        if (Math.abs(dx) + Math.abs(dy) > slop) moved = true;
        if (moved) {
          const s = 0.22 / Math.sqrt(zoomMul);
          center = [center[0] - dx * s, Math.max(-60, Math.min(60, center[1] + dy * s))];
          downAt = { x: e.clientX, y: e.clientY };
        }
      }
      needPick = true;
    };
    const onPointerUp = (e: PointerEvent) => {
      const wasDrag = moved;
      dragging = false;
      if (wasDrag || mode !== "free") return;
      const c = pick(e.clientX, e.clientY);
      if (!c) return;
      // マウスもタッチも「タップ＝その国をひらく」に統一(分かりやすさ優先)
      activate(c);
    };
    const onLeave = () => { mouse.inside = false; hover = null; hlDirty = true; };
    hud.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    hud.addEventListener("pointerleave", onLeave);

    // ── 描画ループ ──
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;

      // サイズずれの自己修復(リサイズイベント取りこぼし対策)
      if (wrap.clientWidth !== w || wrap.clientHeight !== h) resize();

      if (mode === "zoomOut") {
        const t = Math.min(1, (now - zoomT0) / (reduced ? 1 : 1900));
        zoomMul = zoomFromMul + (1 - zoomFromMul) * ease(t);
        if (t >= 1) mode = "free";
      } else if (mode === "zoomIn") {
        const t = Math.min(1, (now - zoomT0) / 2100);
        const e = ease(t);
        let dLon = targetCenter[0] - zoomFrom[0];
        dLon = ((dLon % 360) + 540) % 360 - 180;
        center = [zoomFrom[0] + dLon * e, zoomFrom[1] + (targetCenter[1] - zoomFrom[1]) * e];
        zoomMul = zoomFromMul + (targetMul - zoomFromMul) * e;
        if (t >= 1) finish();
      } else if (!dragging && now - lastInteract > 2600 && !reduced) {
        center = [center[0] - dt * 0.0028, center[1] + (10 - center[1]) * dt * 0.00004];
      }

      earthGroup.rotation.set(center[1] * D2R, (-90 - center[0]) * D2R, 0);
      camera.position.z = camDist();

      if (mode === "free" && mouse.inside && (needPick || now - lastPick > 140)) {
        const prev = hover?.code ?? null;
        hover = pick(mouse.x, mouse.y);
        if ((hover?.code ?? null) !== prev) hlDirty = true;
        needPick = false;
        lastPick = now;
      }
      hud.style.cursor = hover ? "pointer" : "grab";

      if (hlDirty || lastPaintHover !== (hover?.code ?? null)) {
        paintHighlights(hover?.code ?? null);
        lastPaintHover = hover?.code ?? null;
        hlDirty = false;
      }

      // ── 背景(星・星雲・惑星) ──
      bctx.fillStyle = "#07080C";
      bctx.fillRect(0, 0, w, h);
      const neb1 = bctx.createRadialGradient(w * 0.2, h * 0.16, 0, w * 0.2, h * 0.16, w * 0.5);
      neb1.addColorStop(0, "rgba(127,119,221,0.085)");
      neb1.addColorStop(1, "rgba(127,119,221,0)");
      bctx.fillStyle = neb1;
      bctx.fillRect(0, 0, w, h);
      const neb2 = bctx.createRadialGradient(w * 0.82, h * 0.78, 0, w * 0.82, h * 0.78, w * 0.45);
      neb2.addColorStop(0, "rgba(29,158,117,0.06)");
      neb2.addColorStop(1, "rgba(29,158,117,0)");
      bctx.fillStyle = neb2;
      bctx.fillRect(0, 0, w, h);
      const neb3 = bctx.createRadialGradient(w * 0.72, h * 0.1, 0, w * 0.72, h * 0.1, w * 0.3);
      neb3.addColorStop(0, "rgba(216,90,58,0.05)");
      neb3.addColorStop(1, "rgba(216,90,58,0)");
      bctx.fillStyle = neb3;
      bctx.fillRect(0, 0, w, h);

      for (const layer of starLayers) {
        for (const s of layer.stars) {
          const x = (((s.x * w + center[0] * layer.k * 2.2) % w) + w) % w;
          bctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(now / 800 * s.sp + s.tw));
          bctx.fillStyle = s.c;
          bctx.beginPath();
          bctx.arc(x, s.y * h, s.r, 0, 7);
          bctx.fill();
        }
      }
      bctx.globalAlpha = 1;

      const px = w * 0.09, py = h * 0.24;
      bctx.save();
      bctx.translate(px, py);
      bctx.rotate(-0.45);
      const pg = bctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
      pg.addColorStop(0, "#E8C9A0");
      pg.addColorStop(1, "#9C7B4F");
      bctx.beginPath(); bctx.arc(0, 0, 7, 0, 7); bctx.fillStyle = pg; bctx.fill();
      bctx.beginPath(); bctx.ellipse(0, 0, 14.5, 4.4, 0, 0, 7);
      bctx.strokeStyle = "rgba(222,196,150,0.65)"; bctx.lineWidth = 1.4; bctx.stroke();
      bctx.restore();
      bctx.beginPath(); bctx.arc(w * 0.1, h * 0.66, 3, 0, 7);
      bctx.fillStyle = "rgba(208,107,74,0.9)"; bctx.fill();

      if (!shoot && Math.random() < dt * 0.00006 && mode === "free") {
        shoot = { x: Math.random() * w * 0.7 + w * 0.15, y: Math.random() * h * 0.3, vx: 0.45 + Math.random() * 0.3, vy: 0.3 + Math.random() * 0.2, t0: now };
      }
      if (shoot) {
        const t = (now - shoot.t0) / 850;
        if (t >= 1) shoot = null;
        else {
          const sx = shoot.x + shoot.vx * (now - shoot.t0);
          const sy = shoot.y + shoot.vy * (now - shoot.t0);
          bctx.globalAlpha = 0.7 * (1 - t);
          bctx.strokeStyle = "#EDE8DC";
          bctx.lineWidth = 1;
          bctx.beginPath();
          bctx.moveTo(sx, sy);
          bctx.lineTo(sx - shoot.vx * 70, sy - shoot.vy * 70);
          bctx.stroke();
          bctx.globalAlpha = 1;
        }
      }

      // ── 3D ──
      const ma = now * 0.000016 + 1.1;
      moon.position.set(Math.cos(ma) * 2.7, Math.sin(ma * 0.9) * 0.5, Math.sin(ma) * 2.7);
      moon.visible = zoomMul < 2.4;
      renderer.render(scene, camera);

      // ── HUD(太陽・照準・ラベル・日本のパルス) ──
      hctx.clearRect(0, 0, w, h);

      // 太陽: 濃いオレンジの恒星(参考写真準拠・加算合成で白熱)
      {
        const sx0 = w * 0.86, sy0 = h * 0.145;
        const base = Math.min(w, h) * 0.13;
        const flick = 1 + 0.02 * Math.sin(now / 310) + 0.012 * Math.sin(now / 143);
        const sunR = base * flick;
        hctx.globalCompositeOperation = "lighter";

        // 画面全体への暖色の光カブリ
        const wash = hctx.createRadialGradient(sx0, sy0, 0, sx0, sy0, Math.max(w, h) * 1.05);
        wash.addColorStop(0, "rgba(255,140,40,0.16)");
        wash.addColorStop(0.35, "rgba(255,120,30,0.055)");
        wash.addColorStop(1, "rgba(255,110,30,0)");
        hctx.fillStyle = wash;
        hctx.fillRect(0, 0, w, h);

        // 大外周のオレンジ大気(濃く・広く)
        const glow2 = hctx.createRadialGradient(sx0, sy0, 0, sx0, sy0, sunR * 4.4);
        glow2.addColorStop(0, "rgba(255,150,40,0.5)");
        glow2.addColorStop(0.35, "rgba(255,125,30,0.2)");
        glow2.addColorStop(0.7, "rgba(250,105,25,0.07)");
        glow2.addColorStop(1, "rgba(245,100,25,0)");
        hctx.fillStyle = glow2;
        hctx.beginPath();
        hctx.arc(sx0, sy0, sunR * 4.4, 0, 7);
        hctx.fill();

        // 中間グロー(彩度の山・金色)
        const glow1 = hctx.createRadialGradient(sx0, sy0, 0, sx0, sy0, sunR * 2.0);
        glow1.addColorStop(0, "rgba(255,205,90,0.95)");
        glow1.addColorStop(0.4, "rgba(255,170,55,0.55)");
        glow1.addColorStop(0.75, "rgba(255,140,40,0.18)");
        glow1.addColorStop(1, "rgba(255,130,35,0)");
        hctx.fillStyle = glow1;
        hctx.beginPath();
        hctx.arc(sx0, sy0, sunR * 2.0, 0, 7);
        hctx.fill();

        // 白熱コア(中心は完全に飛ぶ)
        const core = hctx.createRadialGradient(sx0, sy0, 0, sx0, sy0, sunR * 0.9);
        core.addColorStop(0, "rgba(255,255,250,1)");
        core.addColorStop(0.25, "rgba(255,248,225,1)");
        core.addColorStop(0.45, "rgba(255,232,165,0.95)");
        core.addColorStop(0.7, "rgba(255,205,100,0.5)");
        core.addColorStop(1, "rgba(255,185,70,0)");
        hctx.fillStyle = core;
        hctx.beginPath();
        hctx.arc(sx0, sy0, sunR * 0.9, 0, 7);
        hctx.fill();

        // 細かい放射状の光条(本数多く・繊細に)
        for (let i = 0; i < 22; i++) {
          const ang = (i / 22) * Math.PI * 2 + 0.13;
          const lenK = 1.3 + ((Math.sin(i * 73.3) * 0.5 + 0.5) ** 2) * 2.6 + (i % 4 === 0 ? 1.0 : 0);
          const len = sunR * lenK;
          const alpha = (0.1 + (Math.sin(i * 37.7) * 0.5 + 0.5) * 0.3) * flick;
          const dx = Math.cos(ang), dy = Math.sin(ang);
          const lg = hctx.createLinearGradient(sx0, sy0, sx0 + dx * len, sy0 + dy * len);
          lg.addColorStop(0, `rgba(255,225,150,${alpha})`);
          lg.addColorStop(0.4, `rgba(255,195,90,${alpha * 0.55})`);
          lg.addColorStop(1, "rgba(255,170,60,0)");
          hctx.strokeStyle = lg;
          hctx.lineWidth = i % 3 === 0 ? 1.7 : 1;
          hctx.beginPath();
          hctx.moveTo(sx0 + dx * sunR * 0.4, sy0 + dy * sunR * 0.4);
          hctx.lineTo(sx0 + dx * len, sy0 + dy * len);
          hctx.stroke();
        }

        // ささやかなレンズゴースト(1つだけ・実写の控えめさ)
        const vx = w / 2 - sx0, vy = h / 2 - sy0;
        const gx = sx0 + vx * 0.55, gy = sy0 + vy * 0.55;
        const gg = hctx.createRadialGradient(gx, gy, 0, gx, gy, sunR * 0.34);
        gg.addColorStop(0, "rgba(255,170,80,0.12)");
        gg.addColorStop(0.7, "rgba(255,150,60,0.06)");
        gg.addColorStop(1, "rgba(255,150,60,0)");
        hctx.fillStyle = gg;
        hctx.beginPath();
        hctx.arc(gx, gy, sunR * 0.34, 0, 7);
        hctx.fill();

        hctx.globalCompositeOperation = "source-over";
      }
      const project = (lat: number, lon: number) => {
        const world = earthGroup.localToWorld(v3(lat, lon));
        const visible = world.z > 1 / camera.position.z - 0.02;
        const v = world.project(camera);
        return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, visible };
      };

      if (mode === "free" && hover?.code !== JAPAN_CODE) {
        const p = project(JP[1], JP[0]);
        if (p.visible) {
          const pulse = 8 + Math.sin(now / 430) * 2.2;
          hctx.beginPath();
          hctx.arc(p.x, p.y, pulse, 0, 7);
          hctx.strokeStyle = "rgba(216,90,58,0.9)";
          hctx.lineWidth = 1.1;
          hctx.stroke();
        }
      }

      if (hover && mode === "free") {
        const [clon, clat] = geoCentroid(hover.feature);
        const p = project(clat, clon);
        if (p.visible) {
          const { x: cx, y: cy } = p;
          const right = cx < w - 180;
          const up = cy > 130;
          const ex = cx + (right ? 52 : -52);
          const ey = cy + (up ? -52 : 52);
          const lineEnd = ex + (right ? 96 : -96);
          hctx.strokeStyle = "rgba(237,232,220,0.9)";
          hctx.lineWidth = 1;
          hctx.beginPath();
          hctx.arc(cx, cy, 3.5, 0, 7);
          hctx.moveTo(cx - 11, cy); hctx.lineTo(cx - 5, cy);
          hctx.moveTo(cx + 5, cy); hctx.lineTo(cx + 11, cy);
          hctx.moveTo(cx, cy - 11); hctx.lineTo(cx, cy - 5);
          hctx.moveTo(cx, cy + 5); hctx.lineTo(cx, cy + 11);
          hctx.stroke();
          hctx.beginPath();
          hctx.moveTo(cx, cy); hctx.lineTo(ex, ey); hctx.lineTo(lineEnd, ey);
          hctx.stroke();
          const n = countsRef.current[hover.code] ?? 0;
          hctx.textAlign = right ? "left" : "right";
          hctx.fillStyle = "#F4EFE3";
          hctx.font = "600 12px 'Zen Kaku Gothic New', sans-serif";
          if ("letterSpacing" in hctx) (hctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "3px";
          hctx.fillText(hover.name.toUpperCase(), ex + (right ? 4 : -4), ey - 7);
          hctx.font = "400 10px 'Zen Kaku Gothic New', sans-serif";
          hctx.fillStyle = n > 0 ? "#E8957C" : "#A6A092";
          hctx.fillText(n > 0 ? `${n} RECORDS` : "NO RECORDS", ex + (right ? 4 : -4), ey + 13);
          if ("letterSpacing" in hctx) (hctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(flyTimer);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      hud.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      hud.removeEventListener("pointerleave", onLeave);
      renderer.dispose();
      earth.geometry.dispose();
      hlSphere.geometry.dispose();
      moon.geometry.dispose();
      atmo.geometry.dispose();
      for (const m of [earthMat, hlMat, atmoMat, moon.material as THREE.Material]) m.dispose();
      for (const t of [texDay, texNight, texWater, hlTex, moonTex]) t.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startFromJapan, flyToKey, flyToCode]);

  return (
    <div ref={wrapRef} style={{ position: "fixed", inset: 0, background: "#07080C", transition: "opacity .55s ease" }}>
      <canvas ref={bgRef} style={{ position: "absolute", inset: 0 }} />
      <canvas ref={glRef} style={{ position: "absolute", inset: 0 }} />
      <canvas ref={hudRef} style={{ position: "absolute", inset: 0, touchAction: "none" }} />
      <div style={{ position: "absolute", top: 42, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
        <div className="caption" style={{ color: "#857E70" }}>MY TRAVEL ATLAS</div>
        <div className="tz-serif" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "0.18em", color: "#EDE8DC", marginTop: 6 }}>
          S-pot
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 26, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
        <span className="caption" style={{ color: "#857E70" }}>
          ドラッグで回す / 国をえらんで、ひらく
        </span>
      </div>
    </div>
  );
}
