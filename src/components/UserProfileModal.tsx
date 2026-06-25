"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { followUser, unfollowUser, isFollowing, getFollowerCount } from "@/lib/follows";
import Photo from "./Photo";
import type { RecordWithPhotos } from "@/lib/records";

type Props = {
  userId: string;
  displayName: string | null;
  onClose: () => void;
  onSelectSpot?: (rec: RecordWithPhotos) => void;
};

type ProfileInfo = {
  bio: string | null;
  area: string | null;
  instagram: string | null;
  website: string | null;
  gear: string | null;
};

// Instagram入力(@id でも URL でも)を開けるURLに正規化
function instaUrl(v: string): string {
  const t = v.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://instagram.com/${t.replace(/^@/, "")}`;
}
function siteUrl(v: string): string {
  const t = v.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export default function UserProfileModal({ userId, displayName, onClose, onSelectSpot }: Props) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [records, setRecords] = useState<RecordWithPhotos[] | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === userId) {
        setIsSelf(true);
      }

      const [fwing, fwCount] = await Promise.all([
        isFollowing(userId),
        getFollowerCount(userId),
      ]);
      setFollowing(fwing);
      setFollowerCount(fwCount);

      // プロフィール詳細(自己紹介・拠点・SNS・機材)
      const { data: prof } = await supabase
        .from("profiles")
        .select("bio, area, instagram, website, gear")
        .eq("id", userId)
        .single();
      setProfile(prof ?? { bio: null, area: null, instagram: null, website: null, gear: null });

      // 公開記録を取得
      const { data } = await supabase
        .from("records")
        .select("*, photos:record_photos(*)")
        .eq("user_id", userId)
        .eq("visibility", "members")
        .order("taken_at", { ascending: false, nullsFirst: false })
        .limit(30);

      if (data && data.length > 0) {
        const paths = (data as RecordWithPhotos[]).flatMap((r) =>
          r.photos.map((p) => p.storage_path)
        );
        const { data: signed } = await supabase.storage
          .from("photos")
          .createSignedUrls(paths, 60 * 60);
        const urlMap = new Map(
          (signed ?? []).map((s) => [s.path, s.signedUrl] as const)
        );
        const recs = data as RecordWithPhotos[];
        for (const r of recs)
          for (const p of r.photos) p.url = urlMap.get(p.storage_path) ?? null;
        setRecords(recs);
      } else {
        setRecords([]);
      }
    })();
  }, [userId]);

  const toggleFollow = async () => {
    setBusy(true);
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
        setFollowerCount((c) => Math.max(0, (c ?? 1) - 1));
      } else {
        await followUser(userId);
        setFollowing(true);
        setFollowerCount((c) => (c ?? 0) + 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)", display: "flex",
        alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "var(--paper)",
          borderRadius: "16px 16px 0 0",
          maxHeight: "85vh", overflowY: "auto",
          padding: "28px 20px 60px",
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* アバター */}
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "var(--shu)", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "var(--paper)", fontSize: 20, fontWeight: 700,
              fontFamily: "serif", flexShrink: 0,
            }}>
              {displayName ? displayName.charAt(0) : "?"}
            </div>
            <div>
              <div className="tz-serif" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.05em" }}>
                {displayName ?? "名無し"}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 3, letterSpacing: "0.08em" }}>
                フォロワー {followerCount ?? "–"} 人
              </div>
            </div>
          </div>

          {/* フォローボタン / 閉じる */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isSelf && following !== null && (
              <button
                onClick={toggleFollow}
                disabled={busy}
                style={{
                  padding: "7px 18px",
                  border: following ? "1px solid var(--hairline)" : "none",
                  background: following ? "transparent" : "var(--shu)",
                  color: following ? "var(--ink-mid)" : "var(--paper)",
                  fontSize: 12, fontFamily: "inherit",
                  letterSpacing: "0.08em", cursor: "pointer",
                  opacity: busy ? 0.6 : 1,
                  borderRadius: 2,
                }}
              >
                {following ? "フォロー中" : "フォローする"}
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--ink-faint)", fontSize: 20, lineHeight: 1, padding: 4,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* プロフィール詳細 */}
        {profile && (profile.bio || profile.area || profile.gear || profile.instagram || profile.website) && (
          <div style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid var(--hairline)" }}>
            {profile.bio && (
              <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.9, margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
                {profile.bio}
              </p>
            )}
            {profile.area && (
              <div style={{ fontSize: 12.5, color: "var(--ink-mid)", marginTop: 4, display: "flex", gap: 8 }}>
                <span style={{ color: "var(--ink-faint)", letterSpacing: "0.1em", flexShrink: 0 }}>拠点</span>
                <span>{profile.area}</span>
              </div>
            )}
            {profile.gear && (
              <div style={{ fontSize: 12.5, color: "var(--ink-mid)", marginTop: 6, display: "flex", gap: 8 }}>
                <span style={{ color: "var(--ink-faint)", letterSpacing: "0.1em", flexShrink: 0 }}>機材</span>
                <span>{profile.gear}</span>
              </div>
            )}
            {(profile.instagram || profile.website) && (
              <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
                {profile.instagram && (
                  <a href={instaUrl(profile.instagram)} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: "var(--shu)", textDecoration: "none", letterSpacing: "0.06em", borderBottom: "1px solid var(--shu)", paddingBottom: 2 }}>
                    Instagram ↗
                  </a>
                )}
                {profile.website && (
                  <a href={siteUrl(profile.website)} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: "var(--shu)", textDecoration: "none", letterSpacing: "0.06em", borderBottom: "1px solid var(--shu)", paddingBottom: 2 }}>
                    サイト ↗
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* 公開記録グリッド */}
        <div className="caption" style={{ marginBottom: 10 }}>
          公開の記録 {records !== null ? `— ${records.length} 件` : ""}
        </div>

        {records === null ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--ink-faint)", fontSize: 12 }}>読み込み中…</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--ink-faint)", fontSize: 12 }}>公開されている記録はありません</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
            {records.map((r) => (
              <div
                key={r.id}
                onClick={() => { onSelectSpot?.(r); onClose(); }}
                role="button"
                style={{
                  aspectRatio: "1", overflow: "hidden",
                  cursor: onSelectSpot ? "pointer" : "default",
                  position: "relative",
                }}
              >
                <Photo rec={r} w="100%" h={120} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
