"use client";

import { useMemo } from "react";
import type { ClipRow } from "@/lib/clips";
import PlanMap from "./PlanMap";

type Props = {
  clips: ClipRow[];
  onBack: () => void;
  onMenu?: () => void;
  onRemove: (id: string) => void;
  onOpenPlans: () => void;
};

// クリップ(行きたい場所の保存)一覧。気になったカフェ・観光地をメモ代わりに見返せる。
export default function ClipsPage({ clips, onBack, onMenu, onRemove, onOpenPlans }: Props) {
  const points = useMemo(
    () => clips.filter((c) => c.lat != null && c.lng != null).map((c) => ({ id: c.id, name: c.name, lat: c.lat!, lng: c.lng! })),
    [clips]
  );

  return (
    <div style={{ padding: "24px 18px 80px" }}>
      <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -8 }}>
          {onMenu && (
            <button aria-label="メニュー" onClick={onMenu} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 8px", display: "inline-flex", flexDirection: "column", gap: 4.5 }}>
              {[0, 1, 2].map((i) => <span key={i} style={{ display: "block", width: 20, height: 1.5, background: "var(--ink)" }} />)}
            </button>
          )}
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.1em" }}>← 地球へ</button>
        </div>

        <div className="caption" style={{ marginTop: 16, fontSize: 9.5, letterSpacing: "0.26em", color: "var(--ink-faint)" }}>CLIPS — 行きたい場所</div>
        <h2 className="tz-serif" style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 4px", letterSpacing: "0.08em" }}>クリップ</h2>
        <div style={{ fontSize: 12, color: "var(--ink-faint)", letterSpacing: "0.06em" }}>
          気になった場所をメモ代わりに。プラン作成のときにここから選べます。
        </div>

        {points.length > 0 && (
          <div style={{ margin: "18px -18px 0" }}>
            <PlanMap points={points} height={280} />
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          {clips.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ink-soft)", textAlign: "center", padding: "36px 20px", lineHeight: 2, border: "1px dashed var(--ink-faint)" }}>
              まだクリップがありません。<br />記録の 🚩 ボタンで、行きたい場所を保存できます。
            </div>
          ) : (
            clips.map((c) => (
              <div key={c.id} style={{ borderBottom: "1px solid var(--hairline)", padding: "13px 0", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ color: "#C9A86A", fontSize: 15, flexShrink: 0, marginTop: 2 }}>🚩</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="tz-serif" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.5 }}>{c.name}</div>
                  {c.address && <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 }}>{c.address}</div>}
                  {c.note && <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.8, marginTop: 4, whiteSpace: "pre-wrap" }}>{c.note}</div>}
                  {c.lat == null && <div style={{ fontSize: 11, color: "var(--shu)", marginTop: 4 }}>※ 位置未設定</div>}
                </div>
                <button onClick={() => onRemove(c.id)} aria-label="クリップを外す" style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 16, cursor: "pointer", padding: 4, flexShrink: 0 }}>×</button>
              </div>
            ))
          )}
        </div>

        {clips.length > 0 && (
          <button onClick={onOpenPlans} style={{ marginTop: 20, width: "100%", padding: "12px", border: "1px solid var(--shu)", background: "transparent", color: "var(--shu)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em", borderRadius: 6 }}>
            クリップを使ってプランをつくる →
          </button>
        )}
      </div>
    </div>
  );
}
