import { supabase } from "./supabase";

// ログインユーザーのお気に入りrecord_idセットを取得
export async function fetchFavoriteIds(): Promise<Set<string>> {
  const { data } = await supabase.from("favorites").select("record_id");
  return new Set((data ?? []).map((r) => r.record_id as string));
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
