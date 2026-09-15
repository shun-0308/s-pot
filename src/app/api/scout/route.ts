import { NextResponse } from "next/server";
import { fetchNearby, topByKind, type Place } from "@/lib/nearby";
import { readCache, writeCache } from "@/lib/nearby-cache";
import { draftScout } from "@/lib/scout-ai";
import { GeminiError } from "@/lib/gemini";

// ロケハン情報の自動下書き。
//   GET  /api/scout?lat=..&lng=..            → 周辺の実データだけ返す（Gemini不使用・無料）
//   POST /api/scout {lat,lng,name,address}   → 実データ + Geminiのロケハン下書き
//
// grounding を使わない理由と全体設計は lib/nearby.ts / lib/gemini.ts の先頭コメント参照。
// 周辺データは nearby_cache に共有キャッシュする（外部APIの無料枠/レート制限対策）。

export const runtime = "nodejs";

function parseLatLng(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  return { lat: a, lng: b };
}

// Geminiに渡す量を絞る（トークン節約 + 精度向上）
const LIMITS = { station: 3, parking: 6, toilet: 2, convenience: 2 } as const;

type Resolved = {
  places: Place[];
  source: "google" | "osm" | "none";
  cached: boolean;
  note: string | null;
};

/** キャッシュ優先で周辺データを解決する */
async function resolveNearby(lat: number, lng: number): Promise<Resolved> {
  const hit = await readCache(lat, lng);
  if (hit) {
    return { places: topByKind(hit.places, LIMITS), source: hit.source, cached: true, note: null };
  }

  const fresh = await fetchNearby(lat, lng);
  if (fresh.source !== "none" && fresh.places.length > 0) {
    // 丸める前の全件を保存しておく（表示上限を後で変えても取り直さずに済む）
    await writeCache(lat, lng, fresh.source, fresh.places);
  }
  return {
    places: topByKind(fresh.places, LIMITS),
    source: fresh.source,
    cached: false,
    note: fresh.note ?? null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pt = parseLatLng(searchParams.get("lat"), searchParams.get("lng"));
  if (!pt) return NextResponse.json({ error: "lat/lng が不正です" }, { status: 400 });

  const r = await resolveNearby(pt.lat, pt.lng);
  return NextResponse.json({ places: r.places, source: r.source, cached: r.cached, note: r.note });
}

export async function POST(req: Request) {
  let body: { lat?: unknown; lng?: unknown; name?: unknown; address?: unknown; season?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSONボディが必要です" }, { status: 400 });
  }

  const pt = parseLatLng(body.lat, body.lng);
  if (!pt) return NextResponse.json({ error: "lat/lng が不正です" }, { status: 400 });

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "この場所";
  const address = typeof body.address === "string" ? body.address : null;
  const season = typeof body.season === "string" ? body.season : undefined;

  const r = await resolveNearby(pt.lat, pt.lng);

  try {
    const scout = await draftScout({
      name,
      address,
      lat: pt.lat,
      lng: pt.lng,
      places: r.places,
      season,
    });
    return NextResponse.json({ scout, places: r.places, source: r.source, cached: r.cached, note: r.note });
  } catch (e) {
    // 周辺データだけでも返す（UIは「AI下書きは失敗、周辺情報は表示」にできる）
    const status = e instanceof GeminiError ? e.status : 500;
    const message =
      status === 429
        ? "Geminiの無料枠を使い切りました。時間をおいてからお試しください"
        : e instanceof Error
          ? e.message
          : "AI下書きの生成に失敗しました";
    return NextResponse.json(
      { scout: null, places: r.places, source: r.source, cached: r.cached, note: r.note, error: message },
      { status: r.places.length > 0 ? 200 : status },
    );
  }
}
