"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSharedPlans, type SharedPlanSummary } from "@/lib/plans";
import { avatarUrl } from "@/lib/profiles";

type Props = {
  onBack: () => void;
  onMenu?: () => void;
  onOpenPlan: (id: string) => void;
};

// みんなのプラン — 他ユーザーが楽しんだおすすめルートを探して、計画のヒントに。
export default function SharedPlansPage({ onBack, onMenu, onOpenPlan }: Props) {
  const [plans, setPlans] = useState<SharedPlanSummary[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setPlans(await fetchSharedPlans()); }
    catch (e) { setErr(e instanceof Error ? e.message : "読み込みに失敗しました"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const results = useMemo(() => {
    if (!plans) return [];
    const kw = q.trim().toLowerCase();
    if (!kw) return plans;
    return plans.filter((p) =>
      [p.title, p.description ?? "", p.display_name ?? "", ...p.item_names].join(" ").toLowerCase().includes(kw)
    );
  }, [plans, q]);

  const Owner = ({ p }: { p: SharedPlanSummary }) => {
    const url = avatarUrl(p.avatar_path);
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 20, height: 20, borderRadius: "50%", overflow: "hidden", background: "#3a3630", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(201,168,106,0.5)", flexShrink: 0 }}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 10, color: "#E3C58C", fontFamily: "serif" }}>{p.display_name ? p.display_name.charAt(0) : "?"}</span>
          )}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>{p.display_name ?? "名無し"}</span>
      </span>
    );
  };

  return (
    <div style={{ padding: "24px 18px 80px" }}>
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -8 }}>
          {onMenu && (
            <button aria-label="メニュー" onClick={onMenu} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 8px", display: "inline-flex", flexDirection: "column", gap: 4.5 }}>
              {[0, 1, 2].map((i) => <span key={i} style={{ display: "block", width: 20, height: 1.5, background: "var(--ink)" }} />)}
            </button>
          )}
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.1em" }}>← 地球へ</button>
        </div>

        <div className="caption" style={{ marginTop: 16, fontSize: 9.5, letterSpacing: "0.26em", color: "var(--ink-faint)" }}>EXPLORE PLANS</div>
        <h2 className="tz-serif" style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 4px", letterSpacing: "0.08em" }}>みんなのプラン</h2>
        <div style={{ fontSize: 12, color: "var(--ink-faint)", letterSpacing: "0.06em" }}>
          みんなのおすすめルートを参考に、次の旅のヒントを。
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, padding: "10px 14px", border: "1px solid var(--hairline)", borderRadius: 999, background: "var(--paper-raise)" }}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="var(--ink-faint)" strokeWidth="1.4"><circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="15" y2="15" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="場所・プラン名・人で検索（例: 京都、カフェ）"
            style={{ flex: 1, border: "none", background: "transparent", color: "var(--ink)", fontSize: 13.5, fontFamily: "inherit", outline: "none" }} />
        </div>

        {err && <div style={{ marginTop: 12, padding: "8px 12px", borderLeft: "2px solid var(--shu)", fontSize: 12.5, color: "var(--shu)" }}>{err}</div>}

        <div style={{ marginTop: 18 }}>
          {plans == null ? (
            <div style={{ fontSize: 13, color: "var(--ink-faint)", textAlign: "center", padding: 30 }}>読み込み中…</div>
          ) : results.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ink-soft)", textAlign: "center", padding: "36px 20px", lineHeight: 2, border: "1px dashed var(--ink-faint)" }}>
              {q.trim() ? "該当するプランが見つかりませんでした。" : <>公開されたプランはまだありません。<br />あなたのプランを「会員に公開」にすると、ここに並びます。</>}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {results.map((p) => (
                <button key={p.id} onClick={() => onOpenPlan(p.id)} style={{ display: "flex", gap: 12, textAlign: "left", background: "var(--paper-raise)", border: "1px solid var(--hairline)", borderRadius: 8, padding: 10, cursor: "pointer", fontFamily: "inherit", alignItems: "stretch" }}>
                  <span style={{ width: 86, height: 86, flexShrink: 0, borderRadius: 6, overflow: "hidden", background: "#e6e2d8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {p.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 22 }}>🗺️</span>
                    )}
                  </span>
                  <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <span>
                      <span className="tz-serif" style={{ display: "block", fontSize: 16, fontWeight: 700, lineHeight: 1.4, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-faint)", marginTop: 3 }}>
                        {p.plan_date ? p.plan_date.replaceAll("-", ".") + " · " : ""}{p.item_count}スポット
                      </span>
                      {p.item_names.length > 0 && (
                        <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.item_names.slice(0, 4).join(" › ")}{p.item_names.length > 4 ? " …" : ""}
                        </span>
                      )}
                    </span>
                    <span style={{ marginTop: 6 }}><Owner p={p} /></span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
