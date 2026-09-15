// 撮影地まわりの「実データ」取得（駅・駐車場・トイレ・コンビニ）。
//
// なぜ Gemini の grounding を使わないか:
//   Google Search / Maps grounding は無料枠に割り当てが無く、1回目の呼び出しから
//   429 RESOURCE_EXHAUSTED になる（2026-07 実測・全モデル一律）。課金必須。
//   そのため「事実の取得はここ（地図API）」「文章化は Gemini」と役割を完全に分ける。
//
// 優先順位（geocode/route.ts と同じ思想）:
//   ① GOOGLE_MAPS_API_KEY があれば Google Places Nearby Search (New) … 精度・網羅性が最高
//   ② 無ければ Overpass(OSM) … 無料・キー不要。ただし公開サーバーは 429/504 が普通に出るので
//      GET + User-Agent + 複数ミラー + リトライで粘る。取れなければ空配列を返す（落とさない）。

export type NearbyKind = "station" | "parking" | "toilet" | "convenience";

export type Place = {
  kind: NearbyKind;
  name: string;
  distance_m: number;
  lat: number;
  lng: number;
  /** 有料/無料が分かる場合のみ。OSM: fee=yes/no、Google: 未提供 */
  fee?: boolean | null;
  /** 収容台数など補足（OSM由来） */
  detail?: string | null;
  source: "google" | "osm";
};

export type NearbyResult = {
  places: Place[];
  source: "google" | "osm" | "none";
  /** 取得できなかった理由（UIで「情報なし」を出し分けるため） */
  note?: string;
};

const UA = "S-pot/1.0 (travel atlas; contact: app@example.com)";

// ── 距離（ハバサイン、メートル） ──
const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── ① Google Places Nearby Search (New) ──
// 月あたりの無料呼び出し枠内で収まる想定。fieldMask で課金ティアを最小限に抑える。
const GOOGLE_TYPES: Record<NearbyKind, string[]> = {
  station: ["train_station", "subway_station"],
  parking: ["parking"],
  toilet: ["public_bathroom"],
  convenience: ["convenience_store"],
};

async function viaGoogle(
  lat: number,
  lng: number,
  kinds: NearbyKind[],
  key: string,
): Promise<Place[]> {
  const out: Place[] = [];
  for (const kind of kinds) {
    const radius = kind === "station" ? 1500 : 600;
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        // 必要な項目だけ要求する = 安いSKUに留める
        "X-Goog-FieldMask": "places.displayName,places.location",
      },
      body: JSON.stringify({
        includedTypes: GOOGLE_TYPES[kind],
        maxResultCount: kind === "parking" ? 10 : 5,
        languageCode: "ja",
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
      }),
    });
    if (!res.ok) continue;
    const data = (await res.json()) as {
      places?: Array<{ displayName?: { text?: string }; location?: { latitude: number; longitude: number } }>;
    };
    for (const p of data.places ?? []) {
      if (!p.location) continue;
      out.push({
        kind,
        name: p.displayName?.text ?? "(名称不明)",
        lat: p.location.latitude,
        lng: p.location.longitude,
        distance_m: distanceM(lat, lng, p.location.latitude, p.location.longitude),
        fee: null,
        detail: null,
        source: "google",
      });
    }
  }
  return out.sort((a, b) => a.distance_m - b.distance_m);
}

// ── ② Overpass(OSM) ──
// 公開エンドポイントは混雑時 429/504 を返す。POST + UA無しだと 406 になるので必ず GET + UA。
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

type OsmElement = {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function overpass(query: string, tries = 2): Promise<OsmElement[] | null> {
  for (let attempt = 0; attempt < tries; attempt++) {
    for (const ep of OVERPASS_ENDPOINTS) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(`${ep}?${new URLSearchParams({ data: query })}`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: ctrl.signal,
          next: { revalidate: 60 * 60 * 24 * 7 }, // 施設情報は週単位で十分
        });
        clearTimeout(timer);
        if (!res.ok) continue;
        const json = (await res.json()) as { elements?: OsmElement[] };
        return json.elements ?? [];
      } catch {
        /* 次のミラーへ */
      }
    }
    await sleep(800 * (attempt + 1));
  }
  return null;
}

const OSM_SELECTOR: Record<NearbyKind, { sel: string; radius: number }> = {
  station: { sel: "[railway=station]", radius: 1500 },
  parking: { sel: "[amenity=parking]", radius: 600 },
  toilet: { sel: "[amenity=toilets]", radius: 600 },
  convenience: { sel: "[shop=convenience]", radius: 600 },
};

async function viaOsm(lat: number, lng: number, kinds: NearbyKind[]): Promise<Place[] | null> {
  // 1リクエストにまとめる（公開サーバーへの負荷とレート制限を抑えるため）
  const blocks = kinds
    .map((k) => {
      const { sel, radius } = OSM_SELECTOR[k];
      return `node(around:${radius},${lat},${lng})${sel};way(around:${radius},${lat},${lng})${sel};`;
    })
    .join("");
  const elements = await overpass(`[out:json][timeout:25];(${blocks});out center 60;`);
  if (elements === null) return null;

  const kindOf = (t: Record<string, string>): NearbyKind | null => {
    if (t.railway === "station") return "station";
    if (t.amenity === "parking") return "parking";
    if (t.amenity === "toilets") return "toilet";
    if (t.shop === "convenience") return "convenience";
    return null;
  };

  const places: Place[] = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    const kind = kindOf(t);
    if (!kind || !kinds.includes(kind)) continue;
    const p = e.type === "node" ? { lat: e.lat, lon: e.lon } : e.center;
    if (!p || p.lat == null || p.lon == null) continue;

    const detail = [
      t.capacity ? `${t.capacity}台` : null,
      t.parking === "multi-storey" ? "立体" : t.parking === "underground" ? "地下" : null,
      t.operator ?? t.brand ?? null,
      t.opening_hours ?? null,
    ]
      .filter(Boolean)
      .join(" / ");

    places.push({
      kind,
      name: t["name:ja"] ?? t.name ?? (kind === "parking" ? "(名称なしの駐車場)" : "(名称不明)"),
      lat: p.lat,
      lng: p.lon,
      distance_m: distanceM(lat, lng, p.lat, p.lon),
      fee: t.fee === "yes" ? true : t.fee === "no" ? false : null,
      detail: detail || null,
      source: "osm",
    });
  }
  return places.sort((a, b) => a.distance_m - b.distance_m);
}

// ── 公開API ──
export async function fetchNearby(
  lat: number,
  lng: number,
  kinds: NearbyKind[] = ["station", "parking", "toilet", "convenience"],
): Promise<NearbyResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (key) {
    try {
      const places = await viaGoogle(lat, lng, kinds, key);
      if (places.length > 0) return { places, source: "google" };
    } catch {
      /* OSMへフォールバック */
    }
  }

  const osm = await viaOsm(lat, lng, kinds).catch(() => null);
  if (osm === null) {
    return {
      places: [],
      source: "none",
      note: key
        ? "周辺情報を取得できませんでした（時間をおいて再試行してください）"
        : "周辺情報を取得できませんでした。GOOGLE_MAPS_API_KEY を設定すると安定します",
    };
  }
  if (osm.length === 0) return { places: [], source: "osm", note: "周辺に該当する施設が見つかりませんでした" };
  return { places: osm, source: "osm" };
}

/** 種別ごとに上限件数で間引く（Geminiに渡す量を絞る） */
export function topByKind(places: Place[], limits: Partial<Record<NearbyKind, number>>): Place[] {
  const count: Record<string, number> = {};
  return places.filter((p) => {
    const max = limits[p.kind] ?? 0;
    count[p.kind] = (count[p.kind] ?? 0) + 1;
    return count[p.kind] <= max;
  });
}
