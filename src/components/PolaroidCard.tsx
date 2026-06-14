"use client";

import Photo from "./Photo";
import type { RecordWithPhotos } from "@/lib/records";

// 記録IDから決定的に微回転を決める(再描画で揺れない)
const tiltOf = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 48) - 24) / 10; // -2.4°〜+2.4°
};

type Props = {
  rec: RecordWithPhotos;
  onClick: () => void; // シングルクリック: 地図の該当地域を光らせる
  onOpen?: () => void; // ダブルクリック: 記録の中身を開く
  onHover?: (hovering: boolean) => void; // 地図の該当地域を点滅させる
};

// ポラロイド風カード: 写真・場所名・日付・ひとこと。上にマスキングテープ
export default function PolaroidCard({ rec, onClick, onOpen, onHover }: Props) {
  const tilt = tiltOf(rec.id);
  return (
    <div onClick={onClick} onDoubleClick={onOpen} className="entry" role="button" tabIndex={0}
      title="クリックで地図を光らせる / ダブルクリックで開く"
      onKeyDown={(e) => e.key === "Enter" && (onOpen ?? onClick)()}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
      style={{
        flexShrink: 0, width: 168, position: "relative",
        background: "var(--paper-raise)",
        padding: "10px 10px 14px",
        boxShadow: "0 3px 12px rgba(46,42,37,0.16)",
        transform: `rotate(${tilt}deg)`,
        borderRadius: 4,
        marginTop: 10,
      }}>
      {/* マスキングテープ */}
      <div style={{
        position: "absolute", top: -8, left: "50%",
        width: 52, height: 16, background: "rgba(206,186,148,0.75)",
        transform: `translateX(-50%) rotate(${-tilt * 1.6 - 3}deg)`,
        boxShadow: "0 1px 2px rgba(46,42,37,0.12)",
      }} />
      <Photo rec={rec} w={148} h={128} />
      {/* 小さな手描きの落書き(山/コーヒー/葉) */}
      <svg viewBox="0 0 16 16" style={{ position: "absolute", right: 10, bottom: 12, width: 17, opacity: 0.45 }}
        fill="none" stroke="var(--ink)" strokeWidth="1" strokeLinejoin="round">
        {Math.abs(tiltOf(rec.id) * 10) % 3 < 1 ? (
          <path d="M1 13 L6 4 L9 9 L11 6 L15 13 Z" />
        ) : Math.abs(tiltOf(rec.id) * 10) % 3 < 2 ? (
          <path d="M3 6 H11 V12 Q 7 14.5 3 12 Z M11 7 Q 14 7.5 11 10 M5 4 q 1 -1.5 0 -2.5 M8 4 q 1 -1.5 0 -2.5" />
        ) : (
          <path d="M3 13 Q 3 5 13 3 Q 12 12 5 12 M5 12 Q 8 8 11 6" />
        )}
      </svg>
      <div style={{ fontSize: 10, color: "var(--tsuchi)", letterSpacing: "0.12em", marginTop: 8 }}>
        {rec.taken_at ? rec.taken_at.replaceAll("-", ".") : "—"}
      </div>
      <div className="hand-jp" style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", marginTop: 1, lineHeight: 1.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {rec.name}
      </div>
      {rec.body && (
        <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7, marginTop: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {rec.body}
        </div>
      )}
    </div>
  );
}
