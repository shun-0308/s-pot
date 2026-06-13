// GPS座標 → 都道府県判定
// 地図と同じ投影(横メルカトル風・cos補正)で点を打ち、県境ポリゴンに対して内外判定(ray casting)。
// 海岸線の簡略化対策として最近傍県フォールバック付き。沖縄は座標範囲でショートカット判定。
import { PREFECTURES, type Prefecture } from "./prefectures";

const GEO = { minx: 128.6, maxx: 146.2, miny: 30.0, maxy: 45.8, W: 760 };
const KX = Math.cos((((GEO.miny + GEO.maxy) / 2) * Math.PI) / 180);
const SX = GEO.W / ((GEO.maxx - GEO.minx) * KX);

export const projGeo = (lon: number, lat: number): [number, number] => [
  (lon - GEO.minx) * KX * SX,
  (GEO.maxy - lat) * SX,
];

// 地図座標 → 緯度経度(逆投影)
export const invGeo = (x: number, y: number): [number, number] => [
  GEO.minx + x / (KX * SX),
  GEO.maxy - y / SX,
];

type Ring = number[][];
const ringsCache: Record<number, Ring[]> = {};
const ringsOf = (p: Prefecture): Ring[] =>
  ringsCache[p.id] ||
  (ringsCache[p.id] = p.d
    .split("Z")
    .filter((s) => s.trim())
    .map((seg) =>
      seg.replace("M", "").trim().split(" ").map((pt) => pt.split(",").map(Number))
    ));

const inRings = (rings: Ring[], x: number, y: number): boolean => {
  let c = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  return c;
};

// 踏破率: 県の本土bboxをグリッド分割し、県内セルのうち記録地点があるセルの割合
export function prefGridStats(
  p: Prefecture,
  points: [number, number][], // 地図座標(projGeo済み)
  bbox: { minX: number; minY: number; w: number; h: number },
  n = 8
): { total: number; visited: number } {
  const rings = ringsOf(p);
  const cw = bbox.w / n;
  const ch = bbox.h / n;
  let total = 0;
  let visited = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = bbox.minX + (i + 0.5) * cw;
      const cy = bbox.minY + (j + 0.5) * ch;
      if (!inRings(rings, cx, cy)) continue;
      total++;
      const x0 = bbox.minX + i * cw;
      const y0 = bbox.minY + j * ch;
      if (points.some(([px, py]) => px >= x0 && px < x0 + cw && py >= y0 && py < y0 + ch)) visited++;
    }
  }
  return { total: Math.max(1, total), visited };
}

// 県境ポリゴンを緯度経度のリング群に変換(Leafletマスク用)。沖縄はインセット座標のため使用不可
export function prefLatLngRings(p: Prefecture): [number, number][][] {
  return p.d
    .split("Z")
    .filter((s) => s.trim())
    .map((seg) =>
      seg.replace("M", "").trim().split(" ").map((pt) => {
        const [x, y] = pt.split(",").map(Number);
        const [lon, lat] = invGeo(x, y);
        return [lat, lon] as [number, number];
      })
    );
}

export function prefFromGPS(lon: number, lat: number): Prefecture | null {
  // 沖縄ショートカット(地図上はインセット配置のため投影では判定できない)
  if (lat < 28 && lon < 132) return PREFECTURES.find((p) => p.name === "沖縄県") ?? null;
  const [x, y] = projGeo(lon, lat);
  const hit = PREFECTURES.find((p) => inRings(ringsOf(p), x, y));
  if (hit) return hit;
  // 最近傍フォールバック(上限あり)
  let best: Prefecture | null = null;
  let bd = 45 * 45;
  for (const p of PREFECTURES) {
    const d = (p.cx - x) ** 2 + (p.cy - y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
