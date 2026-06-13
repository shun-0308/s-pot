// 場所名 → 緯度経度(OpenStreetMap / Nominatim)
// 写真にGPSが無いとき、入力された場所名から座標を補完するために使う。
// 利用規約: 1リクエスト/秒まで・識別可能なRefererが前提(ブラウザが自動付与)。
// 失敗時は null を返す(あくまで補助。手動入力を妨げない)。

export type GeoPoint = { lat: number; lon: number; display?: string };

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

// ごく軽いメモ化(同じ場所名を何度も叩かない)
const cache = new Map<string, GeoPoint | null>();

export async function geocodePlace(
  query: string,
  opts: { jpOnly?: boolean } = {}
): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  const key = `${opts.jpOnly ? "jp:" : ""}${q}`;
  if (cache.has(key)) return cache.get(key)!;

  const params = new URLSearchParams({
    format: "jsonv2",
    q,
    limit: "1",
    "accept-language": "ja",
  });
  if (opts.jpOnly) params.set("countrycodes", "jp");

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    const hit = data[0];
    const point: GeoPoint | null = hit
      ? { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), display: hit.display_name }
      : null;
    cache.set(key, point);
    return point;
  } catch {
    return null;
  }
}
