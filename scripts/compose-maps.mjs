#!/usr/bin/env node
// 後処理合成: AI水彩アートの「隣県への色漏れ」を機械的に除去する
// - 隣県領域(N03実ポリゴン)を紙色で塗り戻し(縁はぼかして水彩になじませる)
// - 隣県の薄い輪郭線を再描画
// - 対象県・海・湖は無加工
// 使い方: node compose-maps.mjs [--only 2,8] [--root /path/to/s-pot]
// 入力: public/maps/N.png(AI生成) → 出力: 同ファイルを上書き(元は .raw.png に退避)

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
const MAPS = path.join(ROOT, "public", "maps");

const GEO = { minx: 128.6, maxx: 146.2, miny: 30.0, maxy: 45.8, W: 760 };
const KX = Math.cos((((GEO.miny + GEO.maxy) / 2) * Math.PI) / 180);
const SX = GEO.W / ((GEO.maxx - GEO.minx) * KX);
const projGeo = (lon, lat) => [(lon - GEO.minx) * KX * SX, (GEO.maxy - lat) * SX];

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

const outlineCache = {};
function prefOutlinePath(id) {
  if (outlineCache[id]) return outlineCache[id];
  const code2 = String(id).padStart(2, "0");
  const topo = JSON.parse(fs.readFileSync(path.join(MUNI_DIR, `${code2}.json`), "utf8"));
  const key = Object.keys(topo.objects)[0];
  const merged = topojson.merge(topo, topo.objects[key].geometries);
  return (outlineCache[id] = { path: ringPath(ringsOfFeature(merged)), rings: ringsOfFeature(merged) });
}

// 沖縄の枠(generate-guides.mjsと同一ロジック)
function okinawaBbox() {
  const { rings } = prefOutlinePath(47);
  let best = null;
  for (const r of rings) { const v = ringBboxArea(r); if (!best || v.area > best.area) best = v; }
  const cx = best.minX + best.w / 2, cy = best.minY + best.h / 2;
  let a = best.minX, b = best.minY, c = best.minX + best.w, d = best.minY + best.h;
  for (const r of rings) {
    const v = ringBboxArea(r);
    const dist = Math.hypot(v.minX + v.w / 2 - cx, v.minY + v.h / 2 - cy);
    if (dist < Math.max(best.w, best.h) * 1.0) {
      a = Math.min(a, v.minX); b = Math.min(b, v.minY);
      c = Math.max(c, v.minX + v.w); d = Math.max(d, v.minY + v.h);
    }
  }
  return { minX: a, minY: b, w: c - a, h: d - b };
}

async function composeOne(pref) {
  const artFile = path.join(MAPS, `${pref.id}.png`);
  if (!fs.existsSync(artFile)) { console.log(`skip ${pref.id} (アートなし)`); return; }

  const bb = pref.id === 47 ? okinawaBbox() : mainRingBbox(pref.d);
  const pad = Math.max(bb.w, bb.h) * 0.2;
  const vx = bb.minX - pad, vy = bb.minY - pad;
  const vw = bb.w + pad * 2, vh = bb.h + pad * 2;

  const meta = await sharp(artFile).metadata();
  const W = meta.width, H = meta.height;
  const s = W / vw;
  const lw = (px) => (px / s).toFixed(4);

  // 紙色: 固定の生成りトーン(隅サンプルは海・washを拾うため不採用)
  const paper = "#F2EAD8";

  const neighbors = PREFS.filter((p) => p.id !== pref.id)
    .map((p) => `<path d="${prefOutlinePath(p.id).path}" />`).join("\n");

  // レイヤー1: 隣県を紙色で塗り戻し(少し膨張+ぼかしで水彩になじませる)
  const fillSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<g transform="scale(${s}) translate(${-vx},${-vy})" fill="${paper}" stroke="${paper}" stroke-width="${lw(4)}" stroke-linejoin="round">${neighbors}</g>
</svg>`;
  const fillLayer = await sharp(Buffer.from(fillSvg)).png().blur(1.2).toBuffer();

  // レイヤー2: 隣県の薄い輪郭線
  const lineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<g transform="scale(${s}) translate(${-vx},${-vy})" fill="none" stroke="#D8CDB4" stroke-width="${lw(1.6)}" opacity="0.85">${neighbors}</g>
</svg>`;
  const lineLayer = await sharp(Buffer.from(lineSvg)).png().toBuffer();

  // 元を退避して合成
  const raw = artFile.replace(/\.png$/, ".raw.png");
  if (!fs.existsSync(raw)) fs.copyFileSync(artFile, raw);
  const out = await sharp(raw)
    .composite([{ input: fillLayer }, { input: lineLayer }])
    .png()
    .toBuffer();
  fs.writeFileSync(artFile, out);
  console.log(`ok ${pref.id} ${pref.name} (paper=${paper})`);
}

const onlyIds = only ? only.split(",").map((x) => parseInt(x, 10)) : null;
for (const p of PREFS.filter((p) => !onlyIds || onlyIds.includes(p.id))) {
  await composeOne(p);
}
console.log("done");
