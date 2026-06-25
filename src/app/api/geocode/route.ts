import { NextResponse } from "next/server";

// サーバー経由のジオコーディング。
// 優先順位:
//   ① GOOGLE_MAPS_API_KEY があれば Google Places Text Search(最高精度・山やランドマークに強い)
//   ② 無ければ Photon(OSMベース・名前検索に強い) → ダメなら Nominatim
// 返り値: { candidates: [{lat, lon, label}], point: 先頭 or null }
//   ・candidates … 検索窓のように複数候補を出して人に選ばせるため
//   ・point      … 旧APIとの互換(単一座標)

type Cand = { lat: number; lon: number; label: string };

const JP_BBOX = { minLon: 122.0, minLat: 24.0, maxLon: 154.0, maxLat: 46.0 };
const UA = "S-pot/1.0 (travel atlas; contact: app@example.com)";

// ── Google Places Text Search(キーがある時だけ) ──
async function viaGoogle(q: string, key: string): Promise<Cand[]> {
  const p = new URLSearchParams({ query: q, key, language: "ja" });
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${p}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{ name?: string; formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }>;
  };
  return (data.results ?? [])
    .filter((r) => r.geometry?.location)
    .slice(0, 6)
    .map((r) => ({
      lat: r.geometry!.location!.lat,
      lon: r.geometry!.location!.lng,
      label: [r.name, r.formatted_address].filter(Boolean).join(" — "),
    }));
}

// ── Photon(OSMベース・名前検索が得意。山/POIに強い) ──
async function viaPhoton(q: string, jpOnly: boolean): Promise<Cand[]> {
  const p = new URLSearchParams({ q, limit: "6" });
  if (jpOnly) p.set("bbox", `${JP_BBOX.minLon},${JP_BBOX.minLat},${JP_BBOX.maxLon},${JP_BBOX.maxLat}`);
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
    // 日本に絞る場合は国コードで弾く
    if (jpOnly && pr.countrycode && pr.countrycode !== "JP") continue;
    const parts = [pr.name, pr.city || pr.county || pr.district, pr.state]
      .filter((x, i, arr) => x && arr.indexOf(x) === i);
    out.push({ lon: c[0], lat: c[1], label: parts.join(", ") || pr.name || "(名称不明)" });
  }
  return out.slice(0, 6);
}

// ── Nominatim(フォールバック) ──
async function viaNominatim(q: string, jpOnly: boolean): Promise<Cand[]> {
  const p = new URLSearchParams({ format: "jsonv2", q, limit: "6", "accept-language": "ja" });
  if (jpOnly) p.set("countrycodes", "jp");
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, {
    headers: { "User-Agent": UA, "Accept-Language": "ja" },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
  return data.map((h) => ({ lat: parseFloat(h.lat), lon: parseFloat(h.lon), label: h.display_name ?? "" }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("q") ?? "").trim();
  const jpOnly = searchParams.get("jp") === "1";
  if (!raw) return NextResponse.json({ candidates: [], point: null });

  // 郵便番号(〒XXX-XXXX)は検索の邪魔になりやすいので除去
  const q = raw.replace(/〒\s*\d{3}-?\d{4}\s*/g, "").trim();
  if (!q) return NextResponse.json({ candidates: [], point: null });

  const googleKey = process.env.GOOGLE_MAPS_API_KEY;

  try {
    let candidates: Cand[] = [];

    if (googleKey) {
      candidates = await viaGoogle(q, googleKey);
    } else {
      // Photon を主、ダメなら Nominatim
      candidates = await viaPhoton(q, jpOnly).catch(() => []);
      if (candidates.length === 0) candidates = await viaNominatim(q, jpOnly).catch(() => []);
      // 番地付きで0件なら、末尾の番地を落として再検索(Nominatim)
      if (candidates.length === 0) {
        const simplified = q.replace(/[０-９0-9]+[丁目番号地]?[－\-]?[０-９0-9]*\s*$/, "").trim();
        if (simplified && simplified !== q) candidates = await viaNominatim(simplified, jpOnly).catch(() => []);
      }
    }

    return NextResponse.json({ candidates, point: candidates[0] ?? null });
  } catch {
    return NextResponse.json({ candidates: [], point: null }, { status: 200 });
  }
}
