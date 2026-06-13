#!/usr/bin/env node
// 形状ガイドv3生成: 実輪郭(国土数値情報N03 2021)+市区町村境界線入り
// 手順: ①県輪郭(実データ) ②市区町村境界 ③AIで水彩化(このガイドを下絵に)
// - 投影は src/lib/geo.ts の projGeo と同一(ピン投影と整合)
// - 枠は PrefArt と同一: mainRingBbox + 20% padding
// - 色: カーキ=対象県 / クリーム=隣接県 / 水色=海 / 白線=市区町村境界
// 使い方: node generate-guides.mjs [--only 13] [--root /path/to/s-pot]
// 依存: npm i sharp topojson-client (スクリプトと同じ場所の node_modules)

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as topojson from "topojson-client";

const args = process.argv.slice(2);
const getArg = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const only = getArg("only");
const ROOT = getArg("root") ?? path.resolve(process.cwd());

const PREFS = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/japan-pref-paths.json"), "utf8"));
const MUNI_DIR = path.join(ROOT, "src/data/municipalities");
const OUT_DIR = path.join(ROOT, "art-guides");

// ── projGeo(src/lib/geo.ts と同一) ──
const GEO = { minx: 128.6, maxx: 146.2, miny: 30.0, maxy: 45.8, W: 760 };
const KX = Math.cos((((GEO.miny + GEO.maxy) / 2) * Math.PI) / 180);
const SX = GEO.W / ((GEO.maxx - GEO.minx) * KX);
const projGeo = (lon, lat) => [(lon - GEO.minx) * KX * SX, (GEO.maxy - lat) * SX];

// ── mainRingBbox(src/lib/prefectures.ts と同一ロジック) ──
function mainRingBbox(d) {
  let best = null, bestArea = -1;
  for (const seg of d.split("Z")) {
    if (!seg.trim()) continue;
    const nums = (seg.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (nums.length < 6) continue;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (let i = 0; i < nums.length; i += 2) {
      minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
      minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area > bestArea) { bestArea = area; best = { minX, minY, w: maxX - minX, h: maxY - minY }; }
  }
  return best;
}

// GeoJSON Polygon/MultiPolygon → 投影済みリング配列
function ringsOfFeature(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  const out = [];
  for (const poly of polys) for (const ring of poly) out.push(ring.map(([lon, lat]) => projGeo(lon, lat)));
  return out;
}
const ringPath = (rings) =>
  rings.map((r) => "M" + r.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L") + "Z").join("");
const ringBboxArea = (r) => {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return { minX: a, minY: b, w: c - a, h: d - b, area: (c - a) * (d - b) };
};

const COLORS = { sea: "#CBDDE4", neighbor: "#F0E7D1", neighborLine: "#D9CEB5", target: "#9C9272", muniLine: "#FFFFFF", outline: "#7E7458" };

// 湖(国土数値情報 湖沼W09)。N03は行政区域のため琵琶湖・霞ヶ浦等が陸になる → 海色で上描き
const LAKES_FILE = path.join(ROOT, "src/data/lakes_w09.json");
let lakeRingsCache = null;
function lakeRings() {
  if (lakeRingsCache) return lakeRingsCache;
  if (!fs.existsSync(LAKES_FILE)) return (lakeRingsCache = []);
  const gj = JSON.parse(fs.readFileSync(LAKES_FILE, "utf8"));
  const out = [];
  for (const f of gj.features) for (const r of ringsOfFeature(f.geometry)) out.push(r);
  return (lakeRingsCache = out);
}

// 各県のN03マージ輪郭(投影済みpath文字列)をキャッシュ。隣接県の下敷きにも実データを使う
const prefOutlineCache = {};
function prefOutlinePath(id) {
  if (prefOutlineCache[id]) return prefOutlineCache[id];
  const code2 = String(id).padStart(2, "0");
  const topo = JSON.parse(fs.readFileSync(path.join(MUNI_DIR, `${code2}.json`), "utf8"));
  const key = Object.keys(topo.objects)[0];
  const merged = topojson.merge(topo, topo.objects[key].geometries);
  return (prefOutlineCache[id] = ringPath(ringsOfFeature(merged)));
}

function generateOne(pref) {
  const code2 = String(pref.id).padStart(2, "0");
  const muniFile = path.join(MUNI_DIR, `${code2}.json`);
  const topo = JSON.parse(fs.readFileSync(muniFile, "utf8"));
  const key = Object.keys(topo.objects)[0];
  let geoms = topo.objects[key].geometries;
  // 東京: 島嶼部(支庁コード13360以上)を除外して本土の枠に集中
  if (pref.id === 13) geoms = geoms.filter((g) => Number(g.properties.N03_007) < 13360);
  const fc = topojson.feature(topo, { type: "GeometryCollection", geometries: geoms });

  const muniRings = fc.features.map((f) => ringsOfFeature(f.geometry));

  // 外周(市区町村をマージ)
  const merged = topojson.merge(topo, geoms);
  const mergedRings = ringsOfFeature(merged);

  // 枠: 1〜46はPrefArtと同一 / 沖縄(47)はマージ外周の最大リング=本島基準(インセット非対応のため特例)
  let bb;
  if (pref.id === 47) {
    let best = null;
    for (const r of mergedRings) {
      const v = ringBboxArea(r);
      if (!best || v.area > best.area) best = v;
    }
    // 本島周辺(慶良間・久米など近傍)を統合、宮古・八重山は枠外
    const cx = best.minX + best.w / 2, cy = best.minY + best.h / 2;
    let a = best.minX, b = best.minY, c = best.minX + best.w, d = best.minY + best.h;
    for (const r of mergedRings) {
      const v = ringBboxArea(r);
      const dist = Math.hypot(v.minX + v.w / 2 - cx, v.minY + v.h / 2 - cy);
      if (dist < Math.max(best.w, best.h) * 1.0) {
        a = Math.min(a, v.minX); b = Math.min(b, v.minY);
        c = Math.max(c, v.minX + v.w); d = Math.max(d, v.minY + v.h);
      }
    }
    bb = { minX: a, minY: b, w: c - a, h: d - b };
  } else {
    bb = mainRingBbox(pref.d);
  }
  const pad = Math.max(bb.w, bb.h) * 0.2;
  const vx = bb.minX - pad, vy = bb.minY - pad;
  const vw = bb.w + pad * 2, vh = bb.h + pad * 2;

  const W = 1600, H = Math.round((W * vh) / vw);
  const s = W / vw;
  const lw = (px) => (px / s).toFixed(4); // 画面px指定→map単位

  // 隣接県(全県のN03実輪郭を敷く。枠外は自動クリップ)
  const neighbors = PREFS.filter((p) => p.id !== pref.id)
    .map((p) => `<path d="${prefOutlinePath(p.id)}" />`).join("\n");

  // 対象県: 市区町村ポリゴン
  const muniPaths = muniRings.map((rings) => `<path d="${ringPath(rings)}" />`).join("\n");
  const outline = ringPath(mergedRings);

  // 枠内に重なり、かつ描画サイズが十分な湖だけ描く(20px四方相当未満はノイズとして省く)
  const inFrame = (r) => {
    const v = ringBboxArea(r);
    const visible = v.minX < vx + vw && v.minX + v.w > vx && v.minY < vy + vh && v.minY + v.h > vy;
    return visible && v.area * s * s > 400;
  };
  const lakePaths = lakeRings().filter(inFrame).map((r) => `<path d="${ringPath([r])}" />`).join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${COLORS.sea}"/>
<g transform="scale(${s}) translate(${-vx},${-vy})">
  <!-- 隣接県: 同色の太strokeで膨張させ、簡略輪郭とN03実データの隙間(偽の川/海)を埋める -->
  <g fill="${COLORS.neighbor}" stroke="${COLORS.neighbor}" stroke-width="${lw(5)}" stroke-linejoin="round">${neighbors}</g>
  <g fill="none" stroke="${COLORS.neighborLine}" stroke-width="${lw(1.2)}">${neighbors}</g>
  <g fill="${COLORS.target}" stroke="${COLORS.muniLine}" stroke-width="${lw(2.2)}" stroke-linejoin="round">${muniPaths}</g>
  ${lakePaths ? `<g fill="${COLORS.sea}" stroke="${COLORS.outline}" stroke-width="${lw(1.2)}">${lakePaths}</g>` : ""}
  <path d="${outline}" fill="none" stroke="${COLORS.outline}" stroke-width="${lw(3)}" stroke-linejoin="round"/>
</g>
</svg>`;

  return sharp(Buffer.from(svg)).png().toFile(path.join(OUT_DIR, `${code2}_guide.png`));
}

const onlyIds = only ? only.split(",").map((s) => parseInt(s, 10)) : null;
const targets = PREFS.filter((p) => !onlyIds || onlyIds.includes(p.id));
for (const p of targets) {
  await generateOne(p);
  console.log(`ok ${String(p.id).padStart(2, "0")} ${p.name}`);
}
console.log("done", targets.length);
