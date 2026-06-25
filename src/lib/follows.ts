import { supabase } from "./supabase";

/** 対象ユーザーをフォローする */
export async function followUser(followingId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("未ログイン");
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: followingId });
  if (error) throw error;
}

/** 対象ユーザーのフォローを外す */
export async function unfollowUser(followingId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("未ログイン");
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);
  if (error) throw error;
}

/** 対象ユーザーをフォローしているか */
export async function isFollowing(followingId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", user.id)
    .eq("following_id", followingId);
  return (count ?? 0) > 0;
}

/** 対象ユーザーのフォロワー数を取得 */
export async function getFollowerCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);
  return count ?? 0;
}

/** 自分がフォローしているユーザーIDの一覧 */
export async function fetchFollowingIds(): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);
  return new Set((data ?? []).map((r: { following_id: string }) => r.following_id));
}

export type FollowUser = { id: string; display_name: string | null; avatar_path: string | null };

async function profilesByIds(ids: string[]): Promise<FollowUser[]> {
  if (!ids.length) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_path")
    .in("id", ids);
  // idの並びを維持
  const map = new Map((data ?? []).map((p) => [p.id, p as FollowUser]));
  return ids.map((id) => map.get(id)).filter((p): p is FollowUser => !!p);
}

/** 自分がフォローしている人（プロフィール付き） */
export async function fetchFollowing(): Promise<FollowUser[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("follows").select("following_id").eq("follower_id", user.id)
    .order("created_at", { ascending: false });
  return profilesByIds((data ?? []).map((r: { following_id: string }) => r.following_id));
}

/** 自分をフォローしている人（プロフィール付き） */
export async function fetchFollowers(): Promise<FollowUser[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("follows").select("follower_id").eq("following_id", user.id)
    .order("created_at", { ascending: false });
  return profilesByIds((data ?? []).map((r: { follower_id: string }) => r.follower_id));
}
