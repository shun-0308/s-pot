"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSharedPlan, duplicatePlan, type SharedPlan } from "@/lib/plans";
import { avatarUrl } from "@/lib/profiles";
import PlanMap from "./PlanMap";

type Props = {
  planId: string;
  onBack: () => void;
  onDuplicated: (newPlanId: string) => void; // 参考にして複製したら自分の編集へ
};

// 公開プランの読み取り専用ビュー。写真つきで他人のおすすめルートを見られる。
export default function PlanView({ planId, onBack, onDuplicated }: Props) {
  const [plan, setPlan] = useState<SharedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setPlan(await fetchSharedPlan(planId)); }
    catch (e) { setErr(e instanceof Error ? e.message : "読み込みに失敗しました"); }
    finally { setLoading(false); }
  }, [planId]);
  useEffect(() => { load(); }, [load]);

  const points = useMemo(
    () => (plan?.items ?? []).filter((i) => i.lat != null && i.lng != null).map((i) => ({ id: i.id, name: i.name, lat: i.lat!, lng: i.lng! })),
    [plan]
  );

  const useThisPlan = async () => {
    setBusy(true); setErr(null);
    try {
      const newId = await duplicatePlan(planId);
      onDuplicated(newId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "複製に失敗しました");
      setBusy(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>読み込み中…</div>;
  if (!plan) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>
      プランが見つかりませんでした（非公開になった可能性があります）。
      <div style={{ marginTop: 16 }}><button onClick={onBack} style={linkBtn}>← 戻る</button></div>
    </div>
  );

  const url = avatarUrl(plan.avatar_path);

  return (
    <div style={{ padding: "24px 18px 96px" }}>
      <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
        <button onClick={onBack} style={linkBtn}>← みんなのプラン</button>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 9.5, letterSpacing: "0.26em", color: "var(--ink-faint)" }}>TRIP PLAN</div>
          <h2 className="tz-serif" style={{ fontSize: 25, fontWeight: 700, margin: "3px 0 6px", letterSpacing: "0.06em" }}>{plan.title}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#3a3630", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(201,168,106,0.5)", flexShrink: 0 }}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 11, color: "#E3C58C", fontFamily: "serif" }}>{plan.display_name ? plan.display_name.charAt(0) : "?"}</span>
              )}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{plan.display_name ?? "名無し"} さんのプラン</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", letterSpacing: "0.06em", marginTop: 6 }}>
            {plan.plan_date ? plan.plan_date.replaceAll("-", ".") + " · " : ""}{plan.items.length}スポット
          </div>
          {plan.description && <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.9, marginTop: 10, whiteSpace: "pre-wrap" }}>{plan.description}</p>}
        </div>

        {err && <div style={{ marginTop: 12, padding: "8px 12px", borderLeft: "2px solid var(--shu)", fontSize: 12.5, color: "var(--shu)" }}>{err}</div>}

        {points.length > 0 && (
          <div style={{ margin: "18px -18px 0" }}>
            <PlanMap points={points} height={300} />
          </div>
        )}

        <div style={{ marginTop: 22, fontSize: 9.5, letterSpacing: "0.26em", color: "var(--ink-faint)" }}>ITINERARY — 行き先</div>
        <div style={{ marginTop: 12 }}>
          {plan.items.map((it, idx) => (
            <div key={it.id} style={{ borderBottom: "1px solid var(--hairline)", padding: "13px 0", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--shu)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "Georgia, serif", marginTop: 1 }}>{idx + 1}</span>
              {it.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.photo_url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="tz-serif" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.5 }}>
                  {it.planned_time && <span style={{ color: "var(--shu)", marginRight: 8, fontSize: 13 }}>{it.planned_time}</span>}
                  {it.name}
                </div>
                {it.address && <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 }}>{it.address}</div>}
                {it.note && <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.8, marginTop: 4, whiteSpace: "pre-wrap" }}>{it.note}</div>}
              </div>
            </div>
          ))}
        </div>

        <button onClick={useThisPlan} disabled={busy} style={{ marginTop: 22, width: "100%", padding: "14px", border: "none", background: "var(--shu)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit", letterSpacing: "0.08em", borderRadius: 6, opacity: busy ? 0.6 : 1 }}>
          {busy ? "複製中…" : "このプランを参考にする（自分用にコピー）"}
        </button>
        <div style={{ fontSize: 11, color: "var(--ink-faint)", textAlign: "center", marginTop: 8, lineHeight: 1.7 }}>
          コピーは自分だけのプランになります。日付や行き先は自由に直せます。
        </div>
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.08em" };
