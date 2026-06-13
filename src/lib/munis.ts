// 市区町村ポリゴン(国土数値情報N03 2021 / public/munis/NN.json)
// 地図⇔写真の連動用: タップ判定・記録→市区町村の対応付け
// 投影は geo.ts の projGeo と同一(PrefArtのviewBoxと整合)
import { feature } from "topojson-client";
import { projGeo } from "./geo";

export type Muni = {
  code: string; // N03_007(5桁)
  name: string; // 市区町村名
  rings: [number, number][][]; // 投影済みリング
  path: string; // SVG path(地図座標)
  cx: number; // 重心(最大リングの面積重心)
  cy: number;
};

type N03Props = { N03_003: string | null; N03_004: string | null; N03_007: string | null };
type GJFeature = {
  properties: N03Props;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};

const cache: Record<number, Muni[]> = {};
const inflight: Record<number, Promise<Muni[]>> = {};

export async function loadMunis(prefId: number): Promise<Muni[]> {
  if (cache[prefId]) return cache[prefId];
  if (!(prefId in inflight)) {
    inflight[prefId] = (async () => {
      const code2 = String(prefId).padStart(2, "0");
      const res = await fetch(`/munis/${code2}.json`);
      if (!res.ok) throw new Error(`munis ${code2}: ${res.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topo = (await res.json()) as any;
      const key = Object.keys(topo.objects)[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fc = feature(topo, topo.objects[key]) as any as { features: GJFeature[] };

      // 同一市区町村(同コード)が複数featureに分かれることがあるためコードで統合
      const byCode = new Map<string, Muni>();
      for (const f of fc.features) {
        const code = f.properties.N03_007 ?? "";
        if (!code) continue;
        const name = f.properties.N03_004 ?? "";
        const polys = (f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.coordinates) as number[][][][];
        const rings: [number, number][][] = [];
        for (const poly of polys)
          for (const ring of poly)
            rings.push(ring.map(([lon, lat]) => projGeo(lon, lat)));
        const cur = byCode.get(code);
        if (cur) cur.rings.push(...rings);
        else byCode.set(code, { code, name, rings, path: "", cx: 0, cy: 0 });
      }
      const list = [...byCode.values()];
      for (const m of list) {
        m.path = m.rings
          .map((r) => "M" + r.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L") + "Z")
          .join("");
        // 重心: 最大面積リングのポリゴン重心
        let best: [number, number][] | null = null;
        let bestA = -1;
        for (const r of m.rings) {
          let a = 0;
          for (let i = 0, j = r.length - 1; i < r.length; j = i++)
            a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
          a = Math.abs(a) / 2;
          if (a > bestA) { bestA = a; best = r; }
        }
        if (best) {
          let a = 0, cx = 0, cy = 0;
          for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
            const f = best[j][0] * best[i][1] - best[i][0] * best[j][1];
            a += f;
            cx += (best[j][0] + best[i][0]) * f;
            cy += (best[j][1] + best[i][1]) * f;
          }
          m.cx = cx / (3 * a);
          m.cy = cy / (3 * a);
        }
      }
      cache[prefId] = list;
      return list;
    })();
  }
  return inflight[prefId];
}

const inRings = (rings: [number, number][][], x: number, y: number): boolean => {
  let c = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  return c;
};

// 地図座標 → 市区町村
export const muniAt = (munis: Muni[], x: number, y: number): Muni | null =>
  munis.find((m) => inRings(m.rings, x, y)) ?? null;

// GPS → 市区町村
export const muniOfPoint = (munis: Muni[], lng: number, lat: number): Muni | null => {
  const [x, y] = projGeo(lng, lat);
  return muniAt(munis, x, y);
};
