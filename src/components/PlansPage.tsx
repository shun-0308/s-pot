"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPlans, createPlan, deletePlan, type PlanSummary } from "@/lib/plans";
import type { Visibility } from "@/lib/supabase";

type Props = {
  onBack: () => void;
  onOpenPlan: (id: string) => void;
  onMenu?: () => void;
};

const VIS_BADGE: Record<Visibility, string> = { private: "自分だけ", members: "会員公開", public: "リンク公開" };

export default function PlansPage({ onBack, onOpenPlan, onMenu }: Props) {
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setPlans(await fetchPlans()); }
    catch (e) { setErr(e instanceof Error ? e.message : "読み込みに失敗しました"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!title.trim()) { setErr("タイトルを入力してください"); return; }
    setBusy(true); setErr(null);
    try {
      const p = await createPlan({ title: title.trim(), plan_date: date || null });
      setTitle(""); setDate(""); setCreating(false);
      onOpenPlan(p.id); // 作成したらそのまま編集へ
    } catch (e) {
      setErr(e instanceof Error ? e.message : "作成に失敗しました");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try { await deletePlan(id); setConfirmId(null); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "削除に失敗しました"); }
    finally { setBusy(false); }
  };

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

        <div className="caption" style={{ marginTop: 16, fontSize: 9.5, letterSpacing: "0.26em", color: "var(--ink-faint)" }}>TRIP PLANS</div>
        <h2 className="tz-serif" style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 4px", letterSpacing: "0.08em" }}>お出かけプラン</h2>
        <div style={{ fontSize: 12, color: "var(--ink-faint)", letterSpacing: "0.06em" }}>
          行きたいスポットを並べて、自分だけの旅のしおりを。
        </div>

        {err && <div style={{ marginTop: 12, padding: "8px 12px", borderLeft: "2px solid var(--shu)", fontSize: 12.5, color: "var(--shu)" }}>{err}</div>}

        {/* 新規作成 */}
        {!creating ? (
          <button onClick={() => setCreating(true)} style={{ marginTop: 18, width: "100%", padding: "14px", border: "1px dashed var(--shu)", background: "transparent", color: "var(--shu)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em", borderRadius: 6 }}>
            ＋ 新しいプランをつくる
          </button>
        ) : (
          <div style={{ marginTop: 18, padding: 14, border: "1px solid var(--hairline)", borderRadius: 6, display: "grid", gap: 10, background: "var(--paper-raise)" }}>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="プラン名（例: 京都ぶらり一日旅）"
              onKeyDown={(e) => e.key === "Enter" && create()}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--hairline)", background: "var(--paper)", color: "var(--ink)", fontSize: 14, fontFamily: "inherit", borderRadius: 4, boxSizing: "border-box" }} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--hairline)", background: "var(--paper)", color: "var(--ink)", fontSize: 14, fontFamily: "inherit", borderRadius: 4, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={create} disabled={busy} style={{ padding: "9px 16px", border: "none", background: "var(--shu)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderRadius: 4 }}>つくる</button>
              <button onClick={() => { setCreating(false); setTitle(""); setDate(""); }} style={{ padding: "9px 16px", border: "1px solid var(--ink-faint)", background: "transparent", color: "var(--ink)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", borderRadius: 4 }}>やめる</button>
            </div>
          </div>
        )}

        {/* 一覧 */}
        <div style={{ marginTop: 22 }}>
          {plans == null ? (
            <div style={{ fontSize: 13, color: "var(--ink-faint)", textAlign: "center", padding: 30 }}>読み込み中…</div>
          ) : plans.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ink-soft)", textAlign: "center", padding: "36px 20px", lineHeight: 2, border: "1px dashed var(--ink-faint)" }}>
              まだプランがありません。<br />最初の旅のしおりをつくってみましょう。
            </div>
          ) : (
            plans.map((p) => (
              <div key={p.id} style={{ borderBottom: "1px solid var(--hairline)", padding: "14px 0", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => onOpenPlan(p.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                  <div className="tz-serif" style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.5, color: "var(--ink)" }}>{p.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 3, letterSpacing: "0.04em" }}>
                    {p.plan_date ? p.plan_date.replaceAll("-", ".") : "日付未定"} · {p.item_count}スポット
                    {p.visibility !== "private" && <span style={{ color: "var(--shu)", marginLeft: 8 }}>{VIS_BADGE[p.visibility]}</span>}
                  </div>
                </button>
                {confirmId === p.id ? (
                  <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => remove(p.id)} disabled={busy} style={{ background: "var(--shu)", color: "#fff", border: "none", fontSize: 11.5, padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>削除</button>
                    <button onClick={() => setConfirmId(null)} style={{ background: "none", border: "1px solid var(--hairline)", fontSize: 11.5, padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", color: "var(--ink)" }}>戻す</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmId(p.id)} aria-label="削除" style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 16, cursor: "pointer", padding: 4, flexShrink: 0 }}>×</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
