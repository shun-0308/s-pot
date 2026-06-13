// 世界の国データ(world-atlas 110m TopoJSON)と GPS→国判定
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldJson from "@/data/world-110m.json";

export type Country = {
  code: string; // ISO 3166-1 numeric(文字列)
  name: string; // 英語名
  feature: Feature<Geometry>;
};

// @ts-expect-error -- TopoJSONの厳密な型は実行時に不要
const fc = feature(worldJson, worldJson.objects.countries) as FeatureCollection<Geometry>;

export const COUNTRIES: Country[] = fc.features
  .filter((f) => f.id != null)
  .map((f) => ({
    code: String(f.id),
    name: (f.properties as { name?: string } | null)?.name ?? "Unknown",
    feature: f,
  }));

export const JAPAN_CODE = "392";

export const countryByCode = (code: string): Country | undefined =>
  COUNTRIES.find((c) => c.code === code);

// GPS座標 → 国判定(日本を最初に判定して高速化)
export function countryFromGPS(lon: number, lat: number): Country | null {
  const jp = countryByCode(JAPAN_CODE);
  if (jp && geoContains(jp.feature, [lon, lat])) return jp;
  for (const c of COUNTRIES) {
    if (c.code === JAPAN_CODE) continue;
    if (geoContains(c.feature, [lon, lat])) return c;
  }
  return null;
}
