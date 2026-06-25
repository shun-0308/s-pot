import { supabase } from "./supabase";

// avatarsバケット内パス → 公開URL(公開バケットなので署名不要)
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

// 切り抜き済みの顔写真(512px正方形のBlob)をアップロードし、profiles.avatar_path を更新。
// 新しいパスを返す。旧画像が残っていれば削除する(容量節約)。
export async function uploadAvatar(blob: Blob): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインしていません");

  // 既存のavatar_pathを控えておく(あとで削除)
  const { data: prof } = await supabase
    .from("profiles").select("avatar_path").eq("id", user.id).single();
  const oldPath = (prof?.avatar_path as string | null) ?? null;

  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw upErr;

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) throw error;

  if (oldPath && oldPath !== path) {
    await supabase.storage.from("avatars").remove([oldPath]).catch(() => {});
  }
  return path;
}
