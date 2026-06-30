import { supabase } from "./supabase";

// クリップ = 「これから行きたい場所」の保存(wishlist)。
// ♡(favorites)は「いいね/思い出」、クリップは「行きたい」で役割を分けている。
// 既存記録(records)由来でも、地図/検索で見つけたフリーな場所でも保存できる。

export type ClipRow = {
  id: string;
  user_id: string;
  record_id: string | null; // 記録由来ならその参照
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  created_at: string;
};

export type ClipInput = {
  record_id?: string | null;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  note?: string | null;
};

// 自分のクリップ一覧(新しい順)
export async function fetchClips(): Promise<ClipRow[]> {
  const { data, error } = await supabase
    .from("clips")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClipRow[];
}

// 記録由来クリップの record_id セット(♡同様、各画面のボタン状態に使う)
export async function fetchClippedRecordIds(): Promise<Set<string>> {
  const { data } = await supabase.from("clips").select("record_id").not("record_id", "is", null);
  return new Set((data ?? []).map((r) => r.record_id as string));
}

export async function addClip(input: ClipInput): Promise<ClipRow | null> {
  const { data, error } = await supabase
    .from("clips")
    .insert({
      record_id: input.record_id ?? null,
      name: input.name,
      address: input.address ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      note: input.note ?? null,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return null; // 既にクリップ済み(同じ記録)
    throw error;
  }
  return data as ClipRow;
}

export async function removeClip(id: string): Promise<void> {
  const { error } = await supabase.from("clips").delete().eq("id", id);
  if (error) throw error;
}

export async function removeClipByRecord(recordId: string): Promise<void> {
  const { error } = await supabase.from("clips").delete().eq("record_id", recordId);
  if (error) throw error;
}

// 記録に対するクリップのトグル。追加したら true、外したら false を返す。
export async function toggleClipForRecord(
  rec: { id: string; name: string; address: string | null; lat: number | null; lng: number | null },
  isClipped: boolean
): Promise<boolean> {
  if (isClipped) {
    await removeClipByRecord(rec.id);
    return false;
  }
  await addClip({ record_id: rec.id, name: rec.name, address: rec.address, lat: rec.lat, lng: rec.lng });
  return true;
}
