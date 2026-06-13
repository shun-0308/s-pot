"use client";

import { useState } from "react";
import RecordForm, { VISIBILITY_LABEL, type FormValues } from "./RecordForm";
import { type RecordWithPhotos } from "@/lib/records";

type Props = {
  backLabel: string; // 戻りリンクの表記(例: 愛媛県の記録)
  captionText: string; // 英字キャプション(例: EHIME — 2026.06.16)
  rec: RecordWithPhotos;
  busy: boolean;
  onBack: () => void;
  onUpdate: (rec: RecordWithPhotos, v: FormValues) => void;
  onDelete: (rec: RecordWithPhotos) => void;
};

// 記録詳細 — 暗幕(ダーク)ビュー。写真と記録文だけが浮かぶ
export default function SpotDetail({ backLabel, captionText, rec, busy, onBack, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const url = rec.photos[0]?.url;

  return (
    <div style={{ background: "var(--dark)", minHeight: "100vh", padding: "26px 20px 90px" }}>
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", color: "var(--dark-faint)", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 22, fontFamily: "inherit", letterSpacing: "0.1em" }}>
          ← {backLabel}
        </button>

        {editing ? (
          <div style={{ background: "var(--paper)", padding: "20px 18px" }}>
            <RecordForm
              title="記録を編集"
              initial={{ name: rec.name, taken_at: rec.taken_at ?? "", body: rec.body ?? "", visibility: rec.visibility, scout: rec.scout ?? {} }}
              existing={rec}
              busy={busy}
              onSubmit={(v) => { onUpdate(rec, v); setEditing(false); }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={rec.name} style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: 240, display: "flex", alignItems: "center", justifyContent: "center", background: "#26231F", color: "var(--dark-faint)", fontSize: 10, letterSpacing: "0.3em" }}>
                NO PHOTO
              </div>
            )}

            <div className="caption" style={{ color: "var(--dark-faint)", marginTop: 20 }}>
              {captionText}
            </div>
            <h2 className="tz-serif" style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 0", lineHeight: 1.5, letterSpacing: "0.04em", color: "var(--dark-strong)" }}>
              {rec.name}
            </h2>

            <p style={{ fontSize: 14.5, lineHeight: 2.3, marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--hairline-dark)", whiteSpace: "pre-wrap", color: "var(--dark-body)", letterSpacing: "0.02em" }}>
              {rec.body || "記録文はまだありません。"}
            </p>

            {/* ロケハン情報 */}
            {rec.scout && Object.values(rec.scout).some(Boolean) && (
              <div style={{ marginTop: 26, border: "1px solid var(--hairline-dark)", padding: "14px 16px 6px" }}>
                <div className="caption" style={{ color: "var(--dark-faint)", marginBottom: 8 }}>
                  LOCATION SCOUTING — ロケハン
                </div>
                {([
                  ["best_time", "ベスト時間帯"],
                  ["tripod", "三脚"],
                  ["permit", "撮影許可"],
                  ["light", "光"],
                  ["access", "アクセス"],
                  ["notes", "メモ"],
                ] as const).map(([k, label]) =>
                  rec.scout?.[k] ? (
                    <div key={k} style={{ display: "flex", gap: 14, padding: "8px 0", borderTop: "1px solid rgba(237,232,220,0.08)" }}>
                      <span style={{ flexShrink: 0, width: 86, fontSize: 10.5, color: "var(--dark-faint)", letterSpacing: "0.12em", paddingTop: 1 }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--dark-body)", lineHeight: 1.8 }}>
                        {rec.scout[k]}
                      </span>
                    </div>
                  ) : null
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 14, marginTop: 28, alignItems: "center" }}>
              <span style={{ fontSize: 10.5, color: "var(--dark-faint)", border: "1px solid var(--hairline-dark)", padding: "4px 12px", letterSpacing: "0.14em" }}>
                {VISIBILITY_LABEL[rec.visibility]}
              </span>
              {rec.lat != null && rec.lng != null && (
                <a href={`https://www.google.com/maps?q=${rec.lat},${rec.lng}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 10.5, color: "var(--dark-faint)", border: "1px solid var(--hairline-dark)", padding: "4px 12px", letterSpacing: "0.14em", textDecoration: "none", marginLeft: 8 }}>
                  地図で開く ↗
                </a>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => setEditing(true)}
                style={{ background: "none", border: "none", color: "var(--dark-faint)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.1em", textDecoration: "underline", textUnderlineOffset: 4 }}>
                編集
              </button>
              {confirming ? (
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={() => onDelete(rec)} disabled={busy}
                    style={{ background: "var(--shu)", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "7px 14px", letterSpacing: "0.1em" }}>
                    {busy ? "削除中…" : "削除する"}
                  </button>
                  <button onClick={() => setConfirming(false)}
                    style={{ background: "none", border: "none", color: "var(--dark-faint)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    やめる
                  </button>
                </span>
              ) : (
                <button onClick={() => setConfirming(true)}
                  style={{ background: "none", border: "none", color: "var(--dark-faint)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.1em", textDecoration: "underline", textUnderlineOffset: 4 }}>
                  削除
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
