"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { followUser, unfollowUser, isFollowing, getFollowerCount } from "@/lib/follows";
import { avatarUrl } from "@/lib/profiles";
import { captionOf } from "@/lib/prefectures";
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
  avatar_path: string | null;
};

const GOLD = "#C9A86A";
const GOLD_SOFT = "#E3C58C";

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
      if (user?.id === userId) setIsSelf(true);

      const [fwing, fwCount] = await Promise.all([isFollowing(userId), getFollowerCount(userId)]);
      setFollowing(fwing);
      setFollowerCount(fwCount);

      const { data: prof } = await supabase
        .from("profiles")
        .select("bio, area, instagram, website, gear, avatar_path")
        .eq("id", userId)
        .single();
      setProfile(prof ?? { bio: null, area: null, instagram: null, website: null, gear: null, avatar_path: null });

      const { data } = await supabase
        .from("records")
        .select("*, photos:record_photos(*)")
        .eq("user_id", userId)
        .eq("visibility", "members")
        .order("taken_at", { ascending: false, nullsFirst: false })
        .limit(30);

      if (data && data.length > 0) {
        const paths = (data as RecordWithPhotos[]).flatMap((r) => r.photos.map((p) => p.storage_path));
        const { data: signed } = await supabase.storage.from("photos").createSignedUrls(paths, 60 * 60);
        const urlMap = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));
        const recs = data as RecordWithPhotos[];
        for (const r of recs) for (const p of r.photos) p.url = urlMap.get(p.storage_path) ?? null;
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

  const avatar = avatarUrl(profile?.avatar_path);
  const hasDetails = !!(profile && (profile.bio || profile.area || profile.gear || profile.instagram || profile.website));

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(5,6,10,0.72)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "linear-gradient(180deg, #1A1D27 0%, #0F1117 100%)",
          border: "1px solid rgba(201,168,106,0.22)", borderBottom: "none",
          borderRadius: "16px 16px 0 0",
          maxHeight: "88vh", overflowY: "auto",
          padding: "26px 22px 60px",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* つまみ */}
        <div style={{ width: 38, height: 4, borderRadius: 2, background: "rgba(201,168,106,0.4)", margin: "0 auto 20px" }} />

        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            {/* アバター(金リング) */}
            <div style={{
              width: 66, height: 66, borderRadius: "50%", padding: 2.5, flexShrink: 0,
              background: `conic-gradient(from 210deg, ${GOLD}, ${GOLD_SOFT}, #8C6E3F, ${GOLD})`,
              boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            }}>
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden",
                background: "#0E0F15", border: "2px solid #0E0F15",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt={displayName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span className="tz-serif" style={{ fontSize: 24, fontWeight: 700, color: GOLD_SOFT }}>
                    {displayName ? displayName.charAt(0) : "?"}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="tz-serif" style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.05em", color: "var(--dark-strong)" }}>
                {displayName ?? "名無し"}
              </div>
              <div style={{ fontSize: 11.5, color: GOLD, marginTop: 4, letterSpacing: "0.1em" }}>
                フォロワー {followerCount ?? "–"} 人
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isSelf && following !== null && (
              <button
                onClick={toggleFollow}
                disabled={busy}
                style={{
                  padding: "8px 18px",
                  border: following ? "1px solid var(--hairline-dark)" : "none",
                  background: following ? "transparent" : `linear-gradient(180deg, ${GOLD_SOFT}, ${GOLD})`,
                  color: following ? "var(--dark-body)" : "#1A1408",
                  fontSize: 12, fontFamily: "inherit", fontWeight: following ? 400 : 700,
                  letterSpacing: "0.08em", cursor: "pointer", opacity: busy ? 0.6 : 1, borderRadius: 2,
                }}
              >
                {following ? "フォロー中" : "フォローする"}
              </button>
            )}
            <button onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dark-faint)", fontSize: 22, lineHeight: 1, padding: 4 }}>
              ×
            </button>
          </div>
        </div>

        {/* プロフィール詳細 */}
        {hasDetails && profile && (
          <div style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid var(--hairline-dark)" }}>
            {profile.bio && (
              <p style={{ fontSize: 13.5, color: "var(--dark-body)", lineHeight: 1.95, margin: "0 0 14px", whiteSpace: "pre-wrap" }}>
                {profile.bio}
              </p>
            )}
            {profile.area && (
              <div style={{ fontSize: 12.5, color: "var(--dark-body)", marginTop: 4, display: "flex", gap: 10 }}>
                <span style={{ color: GOLD, letterSpacing: "0.18em", flexShrink: 0, fontSize: 10, paddingTop: 2 }}>拠点</span>
                <span>{profile.area}</span>
              </div>
            )}
            {profile.gear && (
              <div style={{ fontSize: 12.5, color: "var(--dark-body)", marginTop: 7, display: "flex", gap: 10 }}>
                <span style={{ color: GOLD, letterSpacing: "0.18em", flexShrink: 0, fontSize: 10, paddingTop: 2 }}>機材</span>
                <span>{profile.gear}</span>
              </div>
            )}
            {(profile.instagram || profile.website) && (
              <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
                {profile.instagram && (
                  <a href={instaUrl(profile.instagram)} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: GOLD_SOFT, textDecoration: "none", letterSpacing: "0.06em", borderBottom: `1px solid rgba(201,168,106,0.5)`, paddingBottom: 2 }}>
                    Instagram ↗
                  </a>
                )}
                {profile.website && (
                  <a href={siteUrl(profile.website)} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: GOLD_SOFT, textDecoration: "none", letterSpacing: "0.06em", borderBottom: `1px solid rgba(201,168,106,0.5)`, paddingBottom: 2 }}>
                    サイト ↗
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* 公開記録グリッド */}
        <div style={{ fontSize: 10, letterSpacing: "0.3em", color: GOLD, marginBottom: 12 }}>
          PUBLISHED {records !== null ? `— ${records.length}` : ""}
        </div>

        {records === null ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--dark-faint)", fontSize: 12 }}>読み込み中…</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--dark-faint)", fontSize: 12 }}>公開されている記録はありません</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, padding: "4px 2px 8px" }}>
            {records.map((r, i) => {
              const tilt = ((parseInt(r.id.replace(/\D/g, "").slice(-2) || "0", 10) % 5) - 2) + (i % 2 ? 0.5 : -0.5);
              return (
                <div
                  key={r.id}
                  className="cheki entry"
                  onClick={() => { onSelectSpot?.(r); onClose(); }}
                  role="button"
                  style={{ width: "100%", transform: `rotate(${tilt}deg)`, cursor: onSelectSpot ? "pointer" : "default" }}
                >
                  <span className="pin" />
                  <Photo rec={r} w="100%" h={118} />
                  <div style={{ fontSize: 8.5, letterSpacing: "0.12em", color: "var(--tsuchi)", marginTop: 8 }}>
                    {captionOf(r.pref_code, r.taken_at)}
                  </div>
                  <div className="hand-jp" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 1, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
