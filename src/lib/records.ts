import { supabase, type RecordRow, type RecordPhotoRow, type Visibility, type ScoutInfo } from "./supabase";

export type PhotoWithUrl = RecordPhotoRow & { url: string | null };
export type RecordWithPhotos = RecordRow & { photos: PhotoWithUrl[] };

// 署名付きURLを一括発行(バケットは非公開)
async function attachUrls(records: RecordWithPhotos[]): Promise<RecordWithPhotos[]> {
  const paths = records.flatMap((r) => r.photos.map((p) => p.storage_path));
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from("photos")
      .createSignedUrls(paths, 60 * 60);
    const urlMap = new Map(
      (signed ?? []).map((s) => [s.path, s.signedUrl] as const)
    );
    for (const r of records)
      for (const p of r.photos) p.url = urlMap.get(p.storage_path) ?? null;
  }
  return records;
}

// 自分の全記録+写真を取得
export async function fetchRecords(): Promise<RecordWithPhotos[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("records")
    .select("*, photos:record_photos(*)")
    .eq("user_id", user?.id ?? "")
    .order("taken_at", { ascending: false, nullsFirst: false })
    .order("sort", { referencedTable: "record_photos", ascending: true });
  if (error) throw error;
  return attachUrls((data ?? []) as unknown as RecordWithPhotos[]);
}

// みんなの図鑑: 会員公開された記録(自分の分も含む)
export async function fetchSharedRecords(): Promise<RecordWithPhotos[]> {
  const { data, error } = await supabase
    .from("records")
    .select("*, photos:record_photos(*)")
    .eq("visibility", "members")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return attachUrls((data ?? []) as unknown as RecordWithPhotos[]);
}

// クライアント側リサイズ(長辺2000px・JPEG)
export async function resizeImage(file: File, maxSide = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("画像の変換に失敗しました"))),
      "image/jpeg",
      0.85
    )
  );
}

export type RecordInput = {
  pref_code: number | null; // 日本の記録のみ
  country_code: string; // 日本 = "392"
  name: string;
  address?: string | null; // 位置判定に使う住所/場所名
  taken_at: string | null; // "YYYY-MM-DD"
  body: string;
  lat?: number | null;
  lng?: number | null;
  visibility?: Visibility;
  scout?: ScoutInfo | null;
};

export async function createRecord(
  input: RecordInput,
  photos?: File[] | File | null
): Promise<void> {
  const { data: rec, error } = await supabase
    .from("records")
    .insert({
      pref_code: input.pref_code,
      country_code: input.country_code,
      name: input.name,
      address: input.address ?? null,
      taken_at: input.taken_at,
      body: input.body,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      visibility: input.visibility ?? "private",
      scout: input.scout ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  const list = Array.isArray(photos) ? photos : photos ? [photos] : [];
  // 選んだ順を保つため sort を付けて順番にアップロード
  for (let i = 0; i < list.length; i++) await addPhoto(rec.id, list[i], i);
}

export async function addPhoto(recordId: string, file: File, sort = 0): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしていません");
  const blob = await resizeImage(file);
  const path = `${user.id}/${recordId}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("photos")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (upErr) throw upErr;
  const { error } = await supabase
    .from("record_photos")
    .insert({ record_id: recordId, storage_path: path, sort });
  if (error) throw error;
}

export async function updateRecord(
  id: string,
  input: Partial<RecordInput>
): Promise<void> {
  const { error } = await supabase.from("records").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteRecord(rec: RecordWithPhotos): Promise<void> {
  // Storage上の写真 → 記録行(写真行はcascade)の順で削除
  const paths = rec.photos.map((p) => p.storage_path);
  if (paths.length) await supabase.storage.from("photos").remove(paths);
  const { error } = await supabase.from("records").delete().eq("id", rec.id);
  if (error) throw error;
}

// "2026-06-15" → "2026.06.15"
export const fmtDate = (iso: string | null): string =>
  iso ? iso.replaceAll("-", ".") : "—";
