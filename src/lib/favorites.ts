import { supabase } from "./supabase";

// ログインユーザーのお気に入りrecord_idセットを取得
export async function fetchFavoriteIds(): Promise<Set<string>> {
  const { data } = await supabase.from("favorites").select("record_id");
  return new Set((data ?? []).map((r) => r.record_id as string));
}

// お気に入りをトグル。追加したら true、削除したら false を返す
export async function toggleFavorite(recordId: string, isFav: boolean): Promise<boolean> {
  if (isFav) {
    await supabase.from("favorites").delete().eq("record_id", recordId);
    return false;
  } else {
    await supabase.from("favorites").insert({ record_id: recordId });
    return true;
  }
}
