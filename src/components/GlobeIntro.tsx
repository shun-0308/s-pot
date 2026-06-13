"use client";

import { useEffect, useRef } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import worldJson from "@/data/world-110m.json";

// オープニング演出: 宇宙に浮かぶ地球(日本だけ朱)。クリックで日本へズームイン。
export default function GlobeIntro({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // @ts-expect-error -- TopoJSONの厳密な型は実行時に不要
    const countries = feature(worldJson, worldJson.objects.countries) as FeatureCollection<Geometry>;
    const japan = countries.features.find((f) => String(f.id) === "392") ?? null;
    const others: FeatureCollection<Geometry> = {
      type: "FeatureCollection",
      features: countries.features.filter((f) => String(f.id) !== "392"),
    };
    const graticule = geoGraticule10();
    const sphere = { type: "Sphere" } as const;
    const stars = Array.from({ length: 240 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.1 + 0.3, a: Math.random() * 0.45 + 0.1,
      tw: Math.random() * Math.PI * 2,
    }));

    const projection = geoOrthographic();
    const path = geoPath(projection, ctx);

    let w = 0, h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const JP: [number, number] = [138.5, 37];
    let center: [number, number] = [168, 6];
    let from: [number, number] = center;
    let zooming = false, finished = false, zoomT0 = 0, zoomMul = 1;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finish = () => {
      if (finished) return;
      finished = true;
      wrap.style.opacity = "0";
      window.setTimeout(onDone, 750);
    };

    const startZoom = () => {
      if (zooming || finished) return;
      if (reduced) { finish(); return; }
      zooming = true;
      from = [center[0], center[1]];
      zoomT0 = performance.now();
    };
    wrap.addEventListener("click", startZoom);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;

      if (!zooming) {
        center = [center[0] - dt * 0.0036, center[1]]; // ゆっくり自転
      } else {
        const t = Math.min(1, (now - zoomT0) / 3000);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        let dLon = JP[0] - from[0];
        dLon = ((dLon % 360) + 540) % 360 - 180; // 短い方向に回す
        center = [from[0] + dLon * e, from[1] + (JP[1] - from[1]) * e];
        zoomMul = 1 + 7.4 * e;
        if (t >= 1) finish();
      }

      const R = Math.min(w, h) * 0.34 * zoomMul;
      projection.rotate([-center[0], -center[1]]).translate([w / 2, h / 2]).scale(R).clipAngle(90);

      ctx.fillStyle = "#0A0B0F";
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(now / 900 + s.tw));
        ctx.fillStyle = "#EDE8DC";
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.beginPath(); path(sphere);
      ctx.fillStyle = "#12151B"; ctx.fill();
      ctx.strokeStyle = "rgba(237,232,220,0.10)"; ctx.lineWidth = 1; ctx.stroke();

      ctx.beginPath(); path(graticule);
      ctx.strokeStyle = "rgba(237,232,220,0.05)"; ctx.lineWidth = 0.6; ctx.stroke();

      ctx.beginPath(); path(others);
      ctx.fillStyle = "#31363D"; ctx.fill();

      if (japan) {
        ctx.beginPath(); path(japan);
        ctx.fillStyle = "#B23A24"; ctx.fill();
      }

      // 日本のパルスリング(裏側にあるときは出さない)
      if (!zooming && geoDistance(JP, center) < Math.PI / 2) {
        const p = projection(JP);
        if (p) {
          const pulse = 9 + Math.sin(now / 420) * 2.5;
          ctx.beginPath();
          ctx.arc(p[0], p[1], pulse, 0, 7);
          ctx.strokeStyle = "rgba(216,90,58,0.9)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      wrap.removeEventListener("click", startZoom);
    };
  }, [onDone]);

  return (
    <div ref={wrapRef}
      style={{ position: "fixed", inset: 0, zIndex: 60, cursor: "pointer", background: "#0A0B0F", transition: "opacity 0.75s ease" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <div style={{ position: "absolute", top: 42, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
        <div className="caption" style={{ color: "#857E70" }}>MY TRAVEL ATLAS</div>
        <div className="tz-serif" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "0.18em", color: "#EDE8DC", marginTop: 6 }}>
          S-pot
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 48, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
        <span className="caption" style={{ color: "#A39A87", animation: "blink 2.6s ease infinite" }}>
          クリックして、日本へ
        </span>
      </div>
      <style>{`@keyframes blink { 0%, 100% { opacity: .3 } 50% { opacity: 1 } }`}</style>
    </div>
  );
}
