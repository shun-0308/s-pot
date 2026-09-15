// 周辺施設データのサーバー側キャッシュ（0010_nearby_cache.sql）。
//
// 外部の地図APIは Google なら無料枠、Overpass なら公開サーバーのレート制限（429/504）が
// すぐ効いてくる。同じ撮影地を開くたびに叩かないよう、座標を丸めたキーで結果を共有する。
// サービスロールで読み書きするのでサーバー専用。

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Place } from "./nearby";

/** 小数第4位 ≒ 11m。撮影地としては同一地点とみなせる粒度 */
export function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/** 施設情報は頻繁には変わらないが、新設・閉鎖を拾えるよう30日で作り直す */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

let client: SupabaseClient | null = null;
function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // キャッシュ無しでも動作は継続する
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type CachedNearby = { places: Place[]; source: "google" | "osm" };

export async function readCache(lat: number, lng: number): Promise<CachedNearby | null> {
  const sb = admin();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("nearby_cache")
      .select("places, source, created_at")
      .eq("key", cacheKey(lat, lng))
      .maybeSingle();
    if (error || !data) return null;

    const age = Date.now() - new Date(data.created_at as string).getTime();
    if (age > TTL_MS) return null;

    return { places: data.places as Place[], source: data.source as "google" | "osm" };
  } catch {
    return null; // キャッシュの故障で機能を止めない
  }
}

export async function writeCache(
  lat: number,
  lng: number,
  source: "google" | "osm",
  places: Place[],
): Promise<void> {
  const sb = admin();
  if (!sb) return;
  // 空の結果は保存しない（一時的な取得失敗を30日固定してしまうため）
  if (places.length === 0) return;
  try {
    await sb.from("nearby_cache").upsert(
      { key: cacheKey(lat, lng), lat, lng, source, places, created_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  } catch {
    /* 保存できなくても応答は返す */
  }
}
