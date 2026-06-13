"use client";

import { useEffect, useState } from "react";
import Photo from "./Photo";
import { fetchSharedRecords, type RecordWithPhotos } from "@/lib/records";
import { captionOf } from "@/lib/prefectures";

// みんなの図鑑: 会員公開された記録のフィード
export default function SharedFeed({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<RecordWithPhotos[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSharedRecords()
      .then(setRecords)
      .catch((e) => setError(e instanceof Error ? e.message : "読み込みに失敗しました"));
  }, []);

  return (
    <div style={{ padding: "26px 20px 70px" }}>
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.1em" }}>
          ← 地球へ
        </button>

        <div className="caption" style={{ marginTop: 20 }}>SHARED ATLAS</div>
        <h2 className="tz-serif" style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 4px", letterSpacing: "0.1em" }}>
          みんなの図鑑
        </h2>
        <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 14, letterSpacing: "0.08em" }}>
          S-Lab会員が公開した旅の記録
        </div>

        {error && (
          <div style={{ borderLeft: "2px solid var(--shu)", padding: "8px 14px", fontSize: 12.5, color: "var(--shu)", marginBottom: 14 }}>
            {error}
          </div>
        )}

        {records === null && !error && (
          <div style={{ fontSize: 12, color: "var(--ink-faint)", textAlign: "center", padding: 36, letterSpacing: "0.1em" }}>読み込み中…</div>
        )}

        {records?.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--ink-soft)", textAlign: "center", padding: "44px 20px", lineHeight: 2.2, border: "1px dashed var(--ink-faint)" }}>
            まだ公開された記録がありません。<br />
            記録の作成・編集時に「会員に公開」を選ぶと、ここに表示されます。
          </div>
        )}

        <div style={{ borderTop: records?.length ? "1px solid var(--hairline)" : "none" }}>
          {records?.map((r) => (
            <div key={r.id} style={{ padding: "22px 0", borderBottom: "1px solid var(--hairline)" }}>
              <Photo rec={r} h={210} />
              <div className="caption" style={{ marginTop: 12 }}>{captionOf(r.pref_code, r.taken_at)}</div>
              <div className="tz-serif" style={{ fontSize: 17.5, fontWeight: 700, lineHeight: 1.5, marginTop: 3 }}>
                {r.name}
              </div>
              {r.body && (
                <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 2, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {r.body}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
