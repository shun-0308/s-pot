// 場所名 → 緯度経度(OpenStreetMap / Nominatim)
// 写真にGPSが無いとき、入力された場所名から座標を補完するために使う。
// 利用規約: 1リクエスト/秒まで・識別可能なRefererが前提(ブラウザが自動付与)。
// 失敗時は null を返す(あくまで補助。手動入力を妨げない)。

export type GeoPoint = { lat: number; lon: number; display?: string };

// ごく軽いメモ化(同じ場所名を何度も叩かない)
const cache = new Map<string, GeoPoint | null>();

// 自前のAPIルート(サーバー)経由で問い合わせる。ブラウザ直叩きのUA制約/CORSを回避。
export async function geocodePlace(
  query: string,
  opts: { jpOnly?: boolean } = {}
): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  const key = `${opts.jpOnly ? "jp:" : ""}${q}`;
  if (cache.has(key)) return cache.get(key)!;

  const params = new URLSearchParams({ q });
  if (opts.jpOnly) params.set("jp", "1");

  try {
    const res = await fetch(`/api/geocode?${params.toString()}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { point: GeoPoint | null };
    cache.set(key, data.point ?? null);
    return data.point ?? null;
  } catch {
    return null;
  }
}
