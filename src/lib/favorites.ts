import { supabase } from "./supabase";
import type { RecordWithPhotos } from "./records";

// ログインユーザーのお気に入りrecord_idセットを取得
export async function fetchFavoriteIds(): Promise<Set<string>> {
  const { data } = await supabase.from("favorites").select("record_id");
  return new Set((data ?? []).map((r) => r.record_id as string));
}

// お気に入りに登録した「記録そのもの」を取得(自分・他人の会員公開どちらも)。
// メニューのお気に入り一覧で、みんなの図鑑で付けた他人の記録も表示できるようにする。
// RLSで読めなくなった記録(非公開化された等)は自然に落ちる。
export async function fetchFavoriteRecords(): Promise<RecordWithPhotos[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select("created_at, record:records(*, photos:record_photos(*))")
    .order("created_at", { ascending: false });
  if (error) throw error;

  // supabaseのネスト結合は record を配列 or 単体として推論しうるので両対応で正規化する
  const records = (data ?? [])
    .map((row) => {
      const rec = (row as unknown as { record: RecordWithPhotos | RecordWithPhotos[] | null }).record;
      return Array.isArray(rec) ? rec[0] ?? null : rec;
    })
    .filter((r): r is RecordWithPhotos => !!r);

  if (!records.length) return [];

  // 投稿者の表示名を一括取得
  const userIds = [...new Set(records.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string | null]));
  for (const r of records) r.display_name = nameMap.get(r.user_id) ?? null;

  // 署名付きURLを一括発行
  const paths = records.flatMap((r) => r.photos.map((p) => p.storage_path));
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("photos").createSignedUrls(paths, 60 * 60);
    const urlMap = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));
    for (const r of records) for (const p of r.photos) p.url = urlMap.get(p.storage_path) ?? null;
  }
  return records;
}

// お気に入りをトグル。追加したら true、削除したら false を返す
export async function toggleFavorite(recordId: string, isFav: boolean): Promise<boolean> {
  if (isFav) {
    const { error } = await supabase.from("favorites").delete().eq("record_id", recordId);
    if (error) throw error;
    return false;
  } else {
    // user_id はDB側のデフォルト(auth.uid())で自動補完される
    const { error } = await supabase.from("favorites").insert({ record_id: recordId });
    // 23505 = 既に登録済み(UNIQUE違反)。その場合は「登録済み」として成功扱い
    if (error && error.code !== "23505") throw error;
    return true;
  }
}
