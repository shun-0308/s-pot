"use client";

import { useMemo, useState } from "react";
import Photo from "./Photo";
import type { RecordWithPhotos } from "@/lib/records";
import { captionOf, PREFECTURES } from "@/lib/prefectures";
import { countryByCode, JAPAN_CODE } from "@/lib/world";

type Props = {
  records: RecordWithPhotos[];
  onBack: () => void;
  onSelectSpot: (rec: RecordWithPhotos) => void;
};

const selectStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 120,
  padding: "9px 10px",
  border: "1px solid var(--hairline)",
  background: "var(--paper-raise)",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: 13,
  borderRadius: 0,
};

export default function SearchPage({ records, onBack, onSelectSpot }: Props) {
  const [q, setQ] = useState("");
  const [prefFilter, setPrefFilter] = useState<string>(""); // pref id as string
  const [yearFilter, setYearFilter] = useState<string>("");

  // 撮影年の候補(新しい順)
  const years = useMemo(() => {
    const s = new Set<string>();
    for (const r of records) if (r.taken_at) s.add(r.taken_at.slice(0, 4));
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [records]);

  // 記録のある県だけセレクトに出す(多すぎないように)
  const visitedPrefIds = useMemo(() => {
    const s = new Set<number>();
    for (const r of records)
      if (r.country_code === JAPAN_CODE && r.pref_code != null) s.add(r.pref_code);
    return s;
  }, [records]);

  const caption = (r: RecordWithPhotos) =>
    r.country_code === JAPAN_CODE
      ? captionOf(r.pref_code, r.taken_at)
      : `${(countryByCode(r.country_code)?.name ?? "").toUpperCase()}${r.taken_at ? ` — ${r.taken_at.replaceAll("-", ".")}` : ""}`;

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return records.filter((r) => {
      if (kw) {
        const hay = `${r.name} ${r.body ?? ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      if (prefFilter && !(r.country_code === JAPAN_CODE && String(r.pref_code) === prefFilter))
        return false;
      if (yearFilter && r.taken_at?.slice(0, 4) !== yearFilter) return false;
      return true;
    });
  }, [records, q, prefFilter, yearFilter]);

  const hasFilter = q.trim() || prefFilter || yearFilter;

  return (
    <div style={{ padding: "26px 20px 70px" }}>
      <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.1em" }}>
          ← 地球へ
        </button>

        <div className="caption" style={{ marginTop: 16 }}>SEARCH</div>
        <h2 className="tz-serif" style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 14px", letterSpacing: "0.1em" }}>
          記録をさがす
        </h2>

        {/* キーワード */}
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
          placeholder="場所名・記録文のことばで検索(例: 紫陽花、城、夕暮れ)"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid var(--hairline)", background: "var(--paper-raise)", color: "var(--ink)", fontFamily: "inherit", fontSize: 14, borderRadius: 0, marginBottom: 10 }} />

        {/* 県・年フィルタ */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <select value={prefFilter} onChange={(e) => setPrefFilter(e.target.value)} style={selectStyle}>
            <option value="">すべての県</option>
            {PREFECTURES.filter((p) => visitedPrefIds.has(p.id)).map((p) => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={selectStyle}>
            <option value="">すべての年</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          {hasFilter && (
            <button onClick={() => { setQ(""); setPrefFilter(""); setYearFilter(""); }}
              style={{ border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink-faint)", fontSize: 12, padding: "0 14px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}>
              クリア
            </button>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: "var(--ink-faint)", letterSpacing: "0.08em", margin: "6px 0 4px" }}>
          {hasFilter ? `${results.length} 件` : `全 ${records.length} 件`}
        </div>

        {results.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-soft)", textAlign: "center", padding: "44px 20px", lineHeight: 2.2, border: "1px dashed var(--ink-faint)", marginTop: 14 }}>
            {hasFilter ? "条件に合う記録が見つかりませんでした。" : "まだ記録がありません。"}
          </div>
        ) : (
          results.map((r) => (
            <div key={r.id} onClick={() => onSelectSpot(r)} className="entry" role="button" tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelectSpot(r)}
              style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--hairline)", alignItems: "center" }}>
              <div style={{ flexShrink: 0, width: 72 }}><Photo rec={r} w={72} h={72} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="caption" style={{ fontSize: 9 }}>{caption(r)}</div>
                <div className="tz-serif" style={{ fontSize: 15.5, fontWeight: 700, marginTop: 2, lineHeight: 1.5 }}>
                  {r.name}
                </div>
                {r.body && (
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginTop: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {r.body}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
