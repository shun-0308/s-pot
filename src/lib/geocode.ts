// 場所名・住所 → 緯度経度。
// 実際の問い合わせは自前のAPIルート(/api/geocode)がサーバー側で行う。
// (ブラウザ直叩きだと提供元のUA制約やCORSに引っかかるため)
// 失敗時は空配列/null を返す。あくまで補助で、手動ピンを妨げない。

export type GeoPoint = { lat: number; lon: number; label?: string; display?: string };
/** "point" は建物・施設レベル、"area" は町名など一帯の代表点(狙った場所とは数百mずれうる) */
export type GeoPrecision = "point" | "area";
export type GeoCandidate = { lat: number; lon: number; label: string; source?: string; precision?: GeoPrecision };

export type GeoOpts = {
  jpOnly?: boolean;
  /** 都道府県名(例: "神奈川県")。同名地名の取り違えを防ぐヒント */
  pref?: string | null;
};

function buildParams(q: string, opts: GeoOpts) {
  const params = new URLSearchParams({ q });
  if (opts.jpOnly) params.set("jp", "1");
  if (opts.pref) params.set("pref", opts.pref);
  return params;
}

// 検索窓のように複数候補を返す(ユーザーに選ばせる用)。
export async function geocodeCandidates(query: string, opts: GeoOpts = {}): Promise<GeoCandidate[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`/api/geocode?${buildParams(q, opts).toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { candidates?: GeoCandidate[] };
    return data.candidates ?? [];
  } catch {
    return [];
  }
}

// ごく軽いメモ化(同じ場所名を何度も叩かない)
const cache = new Map<string, GeoPoint | null>();

export async function geocodePlace(query: string, opts: GeoOpts = {}): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  const key = `${opts.jpOnly ? "jp:" : ""}${opts.pref ?? ""}:${q}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(`/api/geocode?${buildParams(q, opts).toString()}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { point: GeoPoint | null };
    cache.set(key, data.point ?? null);
    return data.point ?? null;
  } catch {
    return null;
  }
}
