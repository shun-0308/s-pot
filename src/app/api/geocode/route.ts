import { NextResponse } from "next/server";
import { parseLatLngInput } from "@/lib/geo-input";

// サーバー経由のジオコーディング。
//
// 以前の実装の問題:
//   Photon だけを叩き、0件のときだけ Nominatim に回していた。
//   ところが Photon は日本の「番地つき住所」に弱く、
//   例)「神奈川県大和市中央林間3-19-4」→ 東村山市のドコモショップ
//   のように "0件ではないが全く関係ない" 結果を返す。0件ではないので
//   Nominatim に回らず、誤った候補がそのまま採用されていた。
//
// 新しい実装:
//   ① Photon と Nominatim を並列で叩く(＋日本の住所は表記ゆれを直した再検索も)
//   ② 検索語に含まれる単語と1つも一致しない候補は捨てる(誤爆よけ)
//   ③ 一致度・都道府県の一致・提供元の得意分野でスコア付けして並べる
//
// 返り値: { candidates: [{lat, lon, label, source}], point: 先頭 or null }

export const runtime = "nodejs";

// precision: "point" は建物・施設レベル、"area" は町名や市区町村の代表点。
// area は「その一帯のどこか」でしかないので、UI側で正直にそう伝える。
type Precision = "point" | "area";
type Cand = { lat: number; lon: number; label: string; source: string; precision: Precision };

// 地図データ側の種別から、点なのか面なのかを判定する
const AREA_WORDS = new Set([
  "suburb", "quarter", "neighbourhood", "city_district", "district", "borough",
  "hamlet", "village", "town", "city", "municipality", "county", "state",
  "province", "region", "postcode", "postal_code", "administrative", "locality",
  "island", "archipelago", "political",
]);
const isArea = (...vals: Array<string | undefined>) =>
  vals.some((v) => v && AREA_WORDS.has(v.toLowerCase()));

const JP_VIEWBOX = "122.0,46.5,154.0,20.0"; // 左,上,右,下
const UA = "S-pot/1.0 (personal travel atlas; +https://s-pot.vercel.app)";

const PREF_NAMES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県",
  "埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県",
  "佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

// ── 検索語の正規化 ───────────────────────────────────────────
// 注意: 「ー」(長音符)を一律にハイフンへ直すと「シーパラダイス」が壊れる。
//       数字に挟まれたときだけ区切り記号とみなす。
const toHalf = (s: string) =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
   .replace(/(\d)\s*[－−―‐ー–—]\s*(?=\d)/g, "$1-")
   .replace(/[－−―‐]/g, "-");

function normalize(raw: string) {
  return toHalf(raw)
    .replace(/〒\s*\d{3}-?\d{4}\s*/g, "") // 郵便番号は検索の邪魔
    .replace(/\s+/g, " ")
    .trim();
}

// 日本の住所は「X丁目Y番Z号」を "X-Y-Z" と書く。
// OSM には丁目までしか無いことが多いので、検索語の段階を用意して順に試す。
function queryLadder(q: string): string[] {
  const out = [q];
  // 例) 中央林間3-19-4 → 中央林間3丁目
  const m = q.match(/^(.*?)(\d+)\s*-\s*\d+(?:\s*-\s*\d+)?\s*$/);
  if (m && m[1].trim()) out.push(`${m[1].trim()}${m[2]}丁目`);
  // 例) 中央林間3-19-4 / 中央林間3丁目19-4 → 中央林間
  const bare = q.replace(/\d+\s*(丁目|番地|番|号)?\s*(-\s*\d+\s*)*$/, "").trim();
  if (bare && bare !== q) out.push(bare);
  return [...new Set(out)].slice(0, 3);
}

// 照合用のトークン。
// 日本語は語の区切りが無いので「神奈川県大和市中央林間」が丸ごと1語になってしまい、
// 「中央林間, 大和市, 神奈川県」という並び順の違う正解ラベルと一致しなくなる。
// そこで 都/道/府/県/市/区/町/村/郡 の直後で切ってから語を取り出す。
function tokens(q: string): string[] {
  const split = q.replace(/([都道府県市区町村郡])/g, "$1 ");
  const raw = (split.match(/[一-龥ぁ-んァ-ヶーA-Za-z0-9]{2,}/g) ?? []).map((x) => x.toLowerCase());
  const out: string[] = [];
  for (const t of raw) {
    if (/^\d+$/.test(t)) continue; // 数字だけの語は誤爆のもと(「19」が別の場所に当たる)
    out.push(t);
    // 「中央林間3」→「中央林間」も候補に。OSM側は「中央林間三丁目」と漢数字のことがある
    const stripped = t.replace(/\d+$/, "");
    if (stripped.length >= 2 && stripped !== t) out.push(stripped);
  }
  return [...new Set(out)];
}

// ── 各プロバイダ ─────────────────────────────────────────────
//
// ⚠️ 旧 Places API（maps.googleapis.com/maps/api/place/textsearch/json）は使わない。
//    2025年3月以降に作った Google Cloud プロジェクトでは「Places API」(レガシー) を
//    有効化できず、キーを入れても常に空振りする。必ず **Places API (New)** を使う。
//    src/lib/nearby.ts も同じく New を使っている。
//
// Google は2つのAPIを併用する。得意分野が違うため:
//   ・Geocoding API      … 住所に強い。番地(丁目-番-号)まで解決でき、
//                          location_type で「建物ピンポイントか/おおよそか」まで分かる
//   ・Places Text Search … 施設名・店名に強い（OSMに無い公共施設もここで当たる）

// Places API (New) Text Search
async function viaGooglePlaces(q: string, key: string, jpOnly: boolean): Promise<Cand[]> {
  const body: Record<string, unknown> = { textQuery: q, languageCode: "ja", maxResultCount: 8 };
  if (jpOnly) body.regionCode = "JP";
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      // 課金ティアを上げないよう、必要な項目だけに絞る
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.types",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    places?: Array<{
      displayName?: { text?: string };
      formattedAddress?: string;
      types?: string[];
      location?: { latitude?: number; longitude?: number };
    }>;
  };
  return (data.places ?? [])
    .filter((r) => r.location?.latitude != null && r.location?.longitude != null)
    .map((r) => ({
      lat: r.location!.latitude!,
      lon: r.location!.longitude!,
      label: [r.displayName?.text, r.formattedAddress?.replace(/^日本、\s*/, "")]
        .filter(Boolean).join(" — "),
      source: "google-places",
      precision: (isArea(...(r.types ?? [])) ? "area" : "point") as Precision,
    }));
}

// Geocoding API（住所→座標。レガシー扱いではなく現役）
async function viaGoogleGeocoding(q: string, key: string, jpOnly: boolean): Promise<Cand[]> {
  const p = new URLSearchParams({ address: q, key, language: "ja" });
  if (jpOnly) p.set("region", "jp");
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${p}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      types?: string[];
      geometry?: { location?: { lat: number; lng: number }; location_type?: string };
    }>;
  };
  if (data.status !== "OK") return [];
  return (data.results ?? [])
    .filter((r) => r.geometry?.location)
    .slice(0, 8)
    .map((r) => {
      // ROOFTOP=建物ぴったり / RANGE_INTERPOLATED=番地から推定 → どちらも「点」
      // GEOMETRIC_CENTER / APPROXIMATE → 区画や町域の代表点なので「およその位置」
      const lt = r.geometry?.location_type ?? "";
      const precise = lt === "ROOFTOP" || lt === "RANGE_INTERPOLATED";
      return {
        lat: r.geometry!.location!.lat,
        lon: r.geometry!.location!.lng,
        label: (r.formatted_address ?? "").replace(/^日本、\s*/, ""),
        source: "google-geocoding",
        precision: (precise && !isArea(...(r.types ?? [])) ? "point" : "area") as Precision,
      };
    });
}

// 💰 料金の都合で「安いほうから順に」当てにいく。
//    Geocoding API      … $5 / 1,000回（月10,000回まで無料）
//    Places Text Search … $32 / 1,000回（月5,000回まで無料）← 6倍以上高い
//
// まず Geocoding だけを叩き、建物レベル(ROOFTOP等=point)で当たったらそこで打ち切る。
// 普通の住所はこれで解決するので、高いほうの Places は呼ばずに済む。
// 施設名のように Geocoding が当てられなかったときだけ Places に進む。
async function viaGoogle(q: string, key: string, jpOnly: boolean): Promise<Cand[]> {
  const geo = await viaGoogleGeocoding(q, key, jpOnly).catch(() => []);
  if (geo.some((c) => c.precision === "point")) return geo;

  const places = await viaGooglePlaces(q, key, jpOnly).catch(() => []);
  return [...places, ...geo];
}

// Photon: 施設名・ランドマークに強い(住所は苦手)
async function viaPhoton(q: string, jpOnly: boolean): Promise<Cand[]> {
  const p = new URLSearchParams({ q, limit: "8", lang: "default" });
  if (jpOnly) { p.set("lat", "36"); p.set("lon", "138"); } // 日本寄りにバイアス
  const res = await fetch(`https://photon.komoot.io/api?${p}`, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, string> }>;
  };
  const out: Cand[] = [];
  for (const f of data.features ?? []) {
    const c = f.geometry?.coordinates;
    if (!c) continue;
    const pr = f.properties ?? {};
    if (jpOnly && pr.countrycode && pr.countrycode !== "JP") continue;
    const parts = [pr.name, pr.street, pr.city || pr.county || pr.district, pr.state]
      .filter((x, i, arr) => x && arr.indexOf(x) === i);
    out.push({
      lon: c[0], lat: c[1],
      label: parts.join(", ") || pr.name || "(名称不明)",
      source: "photon",
      precision: isArea(pr.type, pr.osm_value) ? "area" : "point",
    });
  }
  return out;
}

// Nominatim: 日本の住所(丁目まで)に強い
async function viaNominatim(q: string, jpOnly: boolean): Promise<Cand[]> {
  const p = new URLSearchParams({ format: "jsonv2", q, limit: "8", "accept-language": "ja", addressdetails: "0" });
  if (jpOnly) { p.set("countrycodes", "jp"); p.set("viewbox", JP_VIEWBOX); p.set("bounded", "1"); }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
    headers: { "User-Agent": UA, "Accept-Language": "ja", Referer: "https://s-pot.vercel.app" },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string; category?: string; type?: string; addresstype?: string }>;
  return data.map((h) => ({
    lat: parseFloat(h.lat),
    lon: parseFloat(h.lon),
    // 「…, 日本」の末尾は毎回同じで読みにくいので落とす
    label: (h.display_name ?? "").replace(/,\s*日本$/, "").replace(/,\s*\d{3}-\d{4}$/, ""),
    source: "nominatim",
    precision: isArea(h.type, h.addresstype, h.category === "boundary" ? "administrative" : undefined) ? "area" : "point",
  }));
}

// ── 統合・スコア付け ─────────────────────────────────────────
function rank(cands: Cand[], q: string, pref: string | null, addressLike: boolean): Cand[] {
  const toks = tokens(q);
  const seen = new Map<string, { c: Cand; score: number }>();

  for (const c of cands) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue;
    const label = c.label.toLowerCase();
    const hits = toks.filter((t) => label.includes(t)).length;

    // 検索語とかすりもしない候補は誤爆なので捨てる。
    // ただし Google の結果は表記ゆれや別名を解決済みなので、この足切りから除外する
    // (例:「平群町総合スポーツセンター」に対して正式名称で返ってくる場合がある)。
    if (toks.length > 0 && hits === 0 && !c.source.startsWith("google")) continue;

    let score = hits * 3;
    if (pref && c.label.includes(pref)) score += 4;               // 都道府県が一致
    if (addressLike && c.source === "nominatim") score += 2;      // 住所は Nominatim が得意
    if (!addressLike && c.source === "photon") score += 1;        // 施設名は Photon が得意
    if (c.source.startsWith("google")) score += 5;                // キーがあるなら最優先
    if (toks.length) score += (hits / toks.length) * 3;           // 一致率
    // 点を優先するのは「施設名で探しているとき」だけ。
    // 住所検索で番地が見つからず丁目まで粗くした場合、たまたまその丁目にある
    // 建物(=point)を1位にすると "それっぽいが違う場所" になる。
    // 丁目の代表点(=area)のまま「およその位置」と伝えるほうが正直。
    if (!addressLike && c.precision === "point") score += 1.5;

    // 同じ場所(約11m以内)は1つにまとめ、高い方を残す
    const key = `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
    const prev = seen.get(key);
    if (!prev || score > prev.score) seen.set(key, { c, score });
  }

  return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 6).map((x) => x.c);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q") ?? "";
  const jpOnly = searchParams.get("jp") === "1";
  const prefParam = (searchParams.get("pref") ?? "").trim() || null;

  // 「34.629792, 135.693866」や Googleマップの URL がそのまま貼られた場合は
  // 検索する必要がない。ズレようのない座標なので、そのまま返す。
  const pasted = parseLatLngInput(raw);
  if (pasted) {
    const c: Cand = {
      lat: pasted.lat, lon: pasted.lng,
      label: `座標を直接指定 (${pasted.lat.toFixed(6)}, ${pasted.lng.toFixed(6)})`,
      source: "coords", precision: "point",
    };
    return NextResponse.json({ candidates: [c], point: c });
  }

  const q = normalize(raw);
  if (!q) return NextResponse.json({ candidates: [], point: null });

  // 都道府県のヒント: 明示指定 > 検索語に含まれるもの
  const pref = PREF_NAMES.find((p) => q.includes(p)) ?? (prefParam || null);
  // 都道府県が分かっていて検索語に入っていなければ足す(同名地名の取り違えを防ぐ)
  const qWithPref = pref && !q.includes(pref) ? `${pref}${q}` : q;

  const addressLike = /\d/.test(q) && (/[丁目番地号]/.test(q) || /\d+\s*-\s*\d+/.test(q) || !!pref);

  const googleKey = process.env.GOOGLE_MAPS_API_KEY;

  // 無料プロバイダ(Photon + Nominatim)での検索。Google が無い/空振りしたときの本体。
  const viaFree = async (): Promise<Cand[]> => {
    const ladder = queryLadder(qWithPref);
    // Photon は1発でよい。Nominatim は「1リクエスト/秒」が利用条件なので
    // 並列に投げず、当たるまで順番に試す(番地→丁目→町名 の順に粗くしていく)。
    const photonJob = viaPhoton(ladder[0], jpOnly).catch(() => []);
    const nominatimHits: Cand[] = [];
    for (const step of ladder) {
      const hit = await viaNominatim(step, jpOnly).catch(() => []);
      if (hit.length) { nominatimHits.push(...hit); break; }
    }
    return [...(await photonJob), ...nominatimHits];
  };

  try {
    let candidates: Cand[] = [];

    if (googleKey) {
      candidates = await viaGoogle(qWithPref, googleKey, jpOnly).catch(() => []);
      if (candidates.length === 0 && qWithPref !== q) {
        candidates = await viaGoogle(q, googleKey, jpOnly).catch(() => []);
      }
    }

    // キーが未設定でも、キーが無効/APIが未有効化で空振りしても、必ず無料側で拾い直す。
    // (キーを入れた瞬間に検索が全部死ぬ、という事故を防ぐため)
    if (candidates.length === 0) candidates = await viaFree();

    let ranked = rank(candidates, q, pref, addressLike);

    // それでも0件なら、絞り込みを外してもう一度だけ広く探す
    if (ranked.length === 0) {
      const wide = [
        ...(await viaNominatim(q, false).catch(() => [])),
        ...(await viaPhoton(q, false).catch(() => [])),
      ];
      ranked = rank(wide, q, null, addressLike);
      if (ranked.length === 0) ranked = wide.slice(0, 6); // 最後は無条件で返す
    }

    return NextResponse.json({ candidates: ranked, point: ranked[0] ?? null });
  } catch {
    return NextResponse.json({ candidates: [], point: null }, { status: 200 });
  }
}
