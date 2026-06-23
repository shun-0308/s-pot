"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Photo from "./Photo";
import FavoriteButton from "./FavoriteButton";
import UserProfileModal from "./UserProfileModal";
import { fetchSharedRecords, type RecordWithPhotos } from "@/lib/records";
import { fetchFavoriteIds } from "@/lib/favorites";
import { captionOf } from "@/lib/prefectures";

// SSR を完全に切る（Leaflet は SSR 不可、client mount 後に初期化する）
const SharedMap = dynamic(() => import("./SharedMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 360,
        background: "#EDEDEA",
        borderTop: "1px solid var(--hairline)",
        borderBottom: "1px solid var(--hairline)",
      }}
    />
  ),
});

// ── コンテンツガイドライン ──────────────────────────────────
const GUIDELINES = [
  "旅や撮影に関連する場所の記録を投稿してください",
  "他の会員のプライバシーに配慮した内容にしてください",
  "広告・宣伝目的の投稿はご遠慮ください",
  "著作権を侵害するコンテンツは投稿しないでください",
];

function GuidelineNote() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 11, color: "var(--ink-faint)", padding: 0,
          fontFamily: "inherit", letterSpacing: "0.08em",
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
        投稿ガイドライン
      </button>
      {open && (
        <ul style={{
          marginTop: 8, padding: "12px 16px",
          background: "var(--paper-raise)", border: "1px solid var(--hairline)",
          listStyle: "none", display: "flex", flexDirection: "column", gap: 6,
        }}>
          {GUIDELINES.map((g) => (
            <li key={g} style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6, display: "flex", gap: 8 }}>
              <span style={{ color: "var(--shu)", flexShrink: 0 }}>·</span>{g}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── メインコンポーネント ────────────────────────────────────
export default function SharedFeed({
  onBack,
  onSelectSpot,
}: {
  onBack: () => void;
  onSelectSpot?: (rec: RecordWithPhotos) => void;
}) {
  const [records, setRecords] = useState<RecordWithPhotos[] | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [profileTarget, setProfileTarget] = useState<{ userId: string; displayName: string | null } | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    Promise.all([fetchSharedRecords(), fetchFavoriteIds()])
      .then(([recs, ids]) => {
        setRecords(recs);
        setFavIds(ids);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "読み込みに失敗しました"));
  }, []);

  // 地図のピンをクリック → 対応カードへスクロール
  const handleMapSelect = (rec: RecordWithPhotos) => {
    const el = cardRefs.current.get(rec.id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // フラッシュ効果
      el.style.outline = "2px solid var(--shu)";
      setTimeout(() => { el.style.outline = ""; }, 1200);
    }
    onSelectSpot?.(rec);
  };

  const mapHeight = 360;

  return (
    <div style={{ paddingBottom: 70 }}>
      {/* ── ヘッダー ── */}
      <div style={{ padding: "16px 20px 0", maxWidth: 560, margin: "0 auto" }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", color: "var(--ink-faint)",
            fontSize: 12, cursor: "pointer", padding: 0,
            fontFamily: "inherit", letterSpacing: "0.1em",
          }}
        >
          ← 地球へ
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16, marginBottom: 10 }}>
          <div>
            <div className="caption">SHARED ATLAS</div>
            <h2 className="tz-serif" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.1em", marginTop: 2 }}>
              みんなの図鑑
            </h2>
          </div>
          <GuidelineNote />
        </div>
      </div>

      {/* ── エラー ── */}
      {error && (
        <div style={{ maxWidth: 560, margin: "0 auto 12px", padding: "0 20px" }}>
          <div style={{ borderLeft: "2px solid var(--shu)", padding: "8px 14px", fontSize: 12.5, color: "var(--shu)" }}>
            {error}
          </div>
        </div>
      )}

      {/* ── 地図（上半分） ── */}
      {records && records.length > 0 && (
        <div style={{ marginBottom: 0 }}>
          <SharedMap
            records={records}
            onSelect={handleMapSelect}
            height={mapHeight}
          />
          <div style={{
            padding: "6px 20px", fontSize: 11, color: "var(--ink-faint)",
            borderBottom: "1px solid var(--hairline)",
            background: "var(--paper-raise)",
          }}>
            📍 地図のピンをタップするとスポットへ移動
          </div>
        </div>
      )}

      {/* ── ローディング ── */}
      {records === null && !error && (
        <div style={{ fontSize: 12, color: "var(--ink-faint)", textAlign: "center", padding: 36, letterSpacing: "0.1em" }}>
          読み込み中…
        </div>
      )}

      {/* ── 空 ── */}
      {records?.length === 0 && (
        <div style={{
          maxWidth: 560, margin: "20px auto", padding: "0 20px",
        }}>
          <div style={{
            fontSize: 13, color: "var(--ink-soft)", textAlign: "center",
            padding: "44px 20px", lineHeight: 2.2,
            border: "1px dashed var(--ink-faint)",
          }}>
            まだ公開された記録がありません。<br />
            記録の編集から「会員に公開」を選ぶと、ここに表示されます。
          </div>
        </div>
      )}

      {/* ── カード一覧（下半分） ── */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px" }}>
        {records?.map((r) => (
          <div
            key={r.id}
            ref={(el) => { if (el) cardRefs.current.set(r.id, el); }}
            onClick={() => onSelectSpot?.(r)}
            role={onSelectSpot ? "button" : undefined}
            style={{
              padding: "22px 0",
              borderBottom: "1px solid var(--hairline)",
              cursor: onSelectSpot ? "pointer" : "default",
              transition: "outline 0.1s",
            }}
          >
            {/* 投稿者 */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 10,
            }}>
              <div
                role="button"
                onClick={(e) => { e.stopPropagation(); setProfileTarget({ userId: r.user_id, displayName: r.display_name ?? null }); }}
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--shu)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  color: "var(--paper)", fontSize: 11, fontWeight: 700,
                  fontFamily: "serif", flexShrink: 0,
                }}>
                  {r.display_name ? r.display_name.charAt(0) : "?"}
                </div>
                <span style={{ fontSize: 12, color: "var(--ink-mid)", letterSpacing: "0.08em", fontWeight: 500 }}>
                  {r.display_name ?? "名無し"}
                </span>
              </div>
              <FavoriteButton
                recordId={r.id}
                initialFav={favIds.has(r.id)}
                size={18}
              />
            </div>

            {/* 写真 */}
            <Photo rec={r} h={210} />

            {/* 場所情報 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
              <div className="caption">{captionOf(r.pref_code, r.taken_at)}</div>
            </div>
            <div className="tz-serif" style={{ fontSize: 17.5, fontWeight: 700, lineHeight: 1.5, marginTop: 3 }}>
              {r.name}
            </div>
            {r.body && (
              <div style={{
                fontSize: 13, color: "var(--ink-soft)", lineHeight: 2, marginTop: 6,
                display: "-webkit-box", WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {r.body}
              </div>
            )}
          </div>
        ))}
      </div>

      {profileTarget && (
        <UserProfileModal
          userId={profileTarget.userId}
          displayName={profileTarget.displayName}
          onClose={() => setProfileTarget(null)}
          onSelectSpot={onSelectSpot}
        />
      )}
    </div>
  );
}
