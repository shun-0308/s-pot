"use client";

import { useEffect, useMemo, useState } from "react";
import PrefArt from "./PrefArt";
import PolaroidCard from "./PolaroidCard";
import RecordForm, { type FormValues } from "./RecordForm";
import { type RecordWithPhotos } from "@/lib/records";
import { mainRingBboxOf, PREF_EN, type Prefecture } from "@/lib/prefectures";
import { projGeo, prefGridStats } from "@/lib/geo";
import { loadMunis, muniOfPoint, type Muni } from "@/lib/munis";

type Props = {
  pref: Prefecture;
  records: RecordWithPhotos[];
  adding: boolean;
  autoMsg: string | null;
  formInitial: Partial<FormValues> | undefined;
  busy: boolean;
  onBack: () => void;
  prevPref?: Prefecture | null;
  nextPref?: Prefecture | null;
  onNavPref?: (id: number) => void;
  onSelectSpot: (rec: RecordWithPhotos) => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onCreate: (v: FormValues) => void;
};

export default function PrefPage({
  pref, records, adding, autoMsg, formInitial, busy,
  onBack, prevPref, nextPref, onNavPref, onSelectSpot, onStartAdd, onCancelAdd, onCreate,
}: Props) {
  // 地図⇔写真の連動: 市区町村ポリゴン(沖縄はインセット投影のため非対応)
  const [munis, setMunis] = useState<Muni[] | null>(null);
  const [muniSel, setMuniSel] = useState<Muni | null>(null);
  const [blinkMuni, setBlinkMuni] = useState<string | null>(null);
  const [highlightMuni, setHighlightMuni] = useState<string | null>(null); // カードのクリックで光らせる
  useEffect(() => {
    setMunis(null); setMuniSel(null); setBlinkMuni(null); setHighlightMuni(null);
    if (pref.id === 47) return;
    let alive = true;
    loadMunis(pref.id).then((m) => alive && setMunis(m)).catch(() => {});
    return () => { alive = false; };
  }, [pref.id]);

  // 記録 → 市区町村コード
  const recMuni = useMemo(() => {
    const map = new Map<string, string>();
    if (!munis) return map;
    for (const r of records) {
      if (r.lat == null || r.lng == null) continue;
      const m = muniOfPoint(munis, r.lng, r.lat);
      if (m) map.set(r.id, m.code);
    }
    return map;
  }, [munis, records]);

  // 市区町村ごとの件数(地図のバッジ用)
  const muniCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const code of recMuni.values()) c[code] = (c[code] ?? 0) + 1;
    return c;
  }, [recMuni]);

  // 区に属さない地点(埋め立て島など)。点グローで光らせる
  const orphanPoints = useMemo(
    () =>
      records
        .filter((r) => r.lat != null && r.lng != null && !recMuni.has(r.id))
        .map((r) => ({ id: r.id, lng: r.lng!, lat: r.lat! })),
    [records, recMuni]
  );

  const shownRecords = muniSel ? records.filter((r) => recMuni.get(r.id) === muniSel.code) : records;

  // 統計: 訪れた場所 / 踏破率(グリッド) / 写真枚数
  const stats = useMemo(() => {
    const photos = records.reduce((s, r) => s + r.photos.length, 0);
    const bb = mainRingBboxOf(pref.d);
    // GPS座標のある記録を投影
    const gpsPoints = records
      .filter((r) => r.lat != null && r.lng != null)
      .map((r) => projGeo(r.lng!, r.lat!) as [number, number]);
    // GPS無しの記録は県の中心座標で代替(「訪れた場所」のカウントに含める)
    const noGpsPoints = records
      .filter((r) => r.lat == null || r.lng == null)
      .map(() => [pref.cx, pref.cy] as [number, number]);
    const pts = [...gpsPoints, ...noGpsPoints];
    const grid = pref.id === 47
      ? { total: 1, visited: records.length ? 1 : 0 }
      : prefGridStats(pref, pts, bb, 8);
    return { photos, grid, pct: Math.round((grid.visited / grid.total) * 100) };
  }, [pref, records]);

  return (
    <div style={{ padding: "24px 18px 110px", position: "relative", overflow: "hidden" }}>
      {/* 水彩のにじみ(画面の隅) */}
      <div style={{ position: "absolute", left: -80, bottom: -60, width: 280, height: 240, pointerEvents: "none", opacity: 0.16, background: "radial-gradient(closest-side, var(--koke), transparent 70%)" }} />
      <div style={{ position: "absolute", right: -70, bottom: 60, width: 220, height: 200, pointerEvents: "none", opacity: 0.12, background: "radial-gradient(closest-side, var(--koke-deep), transparent 70%)" }} />

      <div className="card" style={{ maxWidth: "min(1760px, 94vw)", margin: "0 auto", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button onClick={onBack}
            style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.18em" }}>
            ← 日本地図
          </button>
          {/* 隣の県へ移動 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => prevPref && onNavPref?.(prevPref.id)} disabled={!prevPref}
              aria-label={prevPref ? `${prevPref.name}へ` : undefined}
              style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid var(--hairline)", background: "var(--paper-raise)", color: prevPref ? "var(--ink-soft)" : "var(--ink-faint)", fontSize: 12, padding: "5px 11px", cursor: prevPref ? "pointer" : "default", fontFamily: "inherit", opacity: prevPref ? 1 : 0.45, letterSpacing: "0.04em" }}>
              ‹ {prevPref?.name ?? "—"}
            </button>
            <button onClick={() => nextPref && onNavPref?.(nextPref.id)} disabled={!nextPref}
              aria-label={nextPref ? `${nextPref.name}へ` : undefined}
              style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid var(--hairline)", background: "var(--paper-raise)", color: nextPref ? "var(--ink-soft)" : "var(--ink-faint)", fontSize: 12, padding: "5px 11px", cursor: nextPref ? "pointer" : "default", fontFamily: "inherit", opacity: nextPref ? 1 : 0.45, letterSpacing: "0.04em" }}>
              {nextPref?.name ?? "—"} ›
            </button>
          </div>
        </div>

        <div className="pref-grid" style={{ marginTop: 6 }}>
        {/* ── 左: 地図シート ── */}
        <div>
        {/* タイトル */}
        <div style={{ textAlign: "center", margin: "10px 0 0", position: "relative" }}>
          {/* 紙飛行機の手描き */}
          <svg viewBox="0 0 30 22" style={{ position: "absolute", right: "8%", top: -2, width: 34, opacity: 0.5 }}
            fill="none" stroke="var(--ink)" strokeWidth="1.1" strokeLinejoin="round">
            <path d="M2 12 L27 3 L17 19 L13 12 Z M27 3 L13 12" />
            <path d="M4 17 q 3 -1.5 6 0 M2 20 q 2.6 -1.2 5 0" strokeDasharray="2 2" />
          </svg>
          <h2 className="tz-serif" style={{ fontSize: 40, fontWeight: 700, margin: 0, letterSpacing: "0.18em" }}>
            {pref.name}
          </h2>
          <div className="hand-en" style={{ fontSize: 26, color: "#B0714F", marginTop: -6, transform: "rotate(-3deg)" }}>
            {PREF_EN[pref.id].charAt(0) + PREF_EN[pref.id].slice(1).toLowerCase()}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", letterSpacing: "0.22em", marginTop: 8 }}>
            まだ見ぬ景色が、きっとある。
          </div>
        </div>

        {/* 県の一枚絵 */}
        <div style={{ margin: "14px auto 0" }}>
          <PrefArt pref={pref} orphanPoints={orphanPoints}
            munis={munis} selectedMuni={muniSel?.code ?? null} blinkMuni={blinkMuni}
            visitedMunis={new Set(recMuni.values())} highlightMuni={highlightMuni} muniCounts={muniCounts}
            onMuniTap={(m) => {
              // 記録のない区をタップしたら絞り込みは解除(カードが消えたように見えるのを防ぐ)
              const hasRecords = (muniCounts[m.code] ?? 0) > 0;
              setMuniSel((cur) => (cur?.code === m.code || !hasRecords ? null : m));
            }} />
        </div>

        {/* 統計 */}
        <div style={{ display: "flex", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)", padding: "13px 0", margin: "4px 0 18px" }}>
          {[
            {
              label: "訪れた場所",
              icon: <path d="M7 1 C4.5 1 3 3 3 5 C3 8 7 13 7 13 C7 13 11 8 11 5 C11 3 9.5 1 7 1 Z M7 6.4 A1.5 1.5 0 1 1 7 3.4 A1.5 1.5 0 0 1 7 6.4" />,
              value: `${stats.grid.visited}`,
              unit: `/ ${stats.grid.total}`,
            },
            {
              label: "踏破率",
              icon: <path d="M1 12 L5 4 L7.4 8.4 L9 6 L13 12 Z M4.2 5.6 L5 4.8 L5.8 5.6" />,
              value: `${stats.pct}`,
              unit: "%",
            },
            {
              label: "写真の枚数",
              icon: <path d="M2 4 H5 L6 2.5 H8 L9 4 H12 V11 H2 Z M7 9.6 A2.1 2.1 0 1 0 7 5.4 A2.1 2.1 0 0 0 7 9.6" />,
              value: `${stats.photos}`,
              unit: "枚",
            },
          ].map((s, i) => (
            <div key={s.label} style={{ flex: 1, textAlign: "center", borderLeft: i ? "1px solid var(--hairline)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <svg viewBox="0 0 14 14" style={{ width: 13, height: 13 }} fill="none"
                  stroke="var(--ink-soft)" strokeWidth="1.1" strokeLinejoin="round">{s.icon}</svg>
                <span style={{ fontSize: 10.5, color: "var(--ink-soft)", letterSpacing: "0.14em" }}>{s.label}</span>
              </div>
              <div style={{ marginTop: 3 }}>
                <span className="tz-serif" style={{ fontSize: 25, fontWeight: 700, color: "var(--ink)" }}>{s.value}</span>
                <span style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: 4 }}>{s.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 手描きの地平線 */}
        <svg viewBox="0 0 560 46" style={{ width: "100%", marginTop: 8, opacity: 0.35 }} fill="none" stroke="var(--ink)" strokeWidth="1">
          <path d="M0 40 H110 L150 12 L190 40 H240 L252 30 L264 40 H300 V24 H306 V40 H336 L344 33 H362 V20 H368 V40 H420 L450 18 L480 40 H560" />
          <circle cx="306" cy="18" r="2.6" />
        </svg>
        </div>

        {/* ── 右: 記録と最近の旅 ── */}
        <div className="pref-side">
        {autoMsg && adding && (
          <div className="card" style={{ borderLeft: "2px solid var(--tsuchi)", padding: "8px 14px", fontSize: 12.5, color: "var(--tsuchi)", margin: "0 0 14px", lineHeight: 1.7 }}>
            {autoMsg}
          </div>
        )}

        {/* CTA */}
        {adding ? (
          <RecordForm title={`${pref.name}の記録`} initial={formInitial} busy={busy}
            onSubmit={onCreate} onCancel={onCancelAdd} />
        ) : (
          <button onClick={onStartAdd}
            style={{ width: "100%", padding: "16px 18px", border: "none", background: "var(--ink)", color: "var(--paper)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.18em", borderRadius: 10, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 3px 12px rgba(46,42,37,0.25)" }}>
            <svg viewBox="0 0 16 14" style={{ width: 17, height: 15 }} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
              <path d="M8 2.5 C6.5 1 4 1 1.5 1.8 V 12 C4 11.2 6.5 11.2 8 12.6 C9.5 11.2 12 11.2 14.5 12 V 1.8 C12 1 9.5 1 8 2.5 Z M8 2.5 V 12.6" />
            </svg>
            旅の記録をつける
            <span style={{ marginLeft: "auto" }}>›</span>
          </button>
        )}

        {/* 最近の記録(ポラロイド)。地域選択中はその地域だけ */}
        {records.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ position: "relative", display: "inline-block" }}>
                <span className="hand-en" style={{ fontSize: 25, color: "var(--ink)", opacity: 0.85 }}>
                  Recent journey
                </span>
                <svg viewBox="0 0 150 8" style={{ position: "absolute", left: 0, bottom: -4, width: "100%" }}
                  fill="none" stroke="var(--tsuchi)" strokeWidth="1.4" opacity="0.6">
                  <path d="M2 5 Q 40 2 75 4.5 T 148 3.5" />
                </svg>
              </span>
              {muniSel && (
                <button onClick={() => setMuniSel(null)}
                  style={{ marginLeft: 12, border: "1px solid var(--tsuchi)", background: "none", color: "var(--tsuchi)", fontSize: 11, padding: "2px 9px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em" }}>
                  {muniSel.name} ✕
                </button>
              )}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
                {shownRecords.length} 件
              </span>
            </div>
            {shownRecords.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", padding: "26px 8px", lineHeight: 2 }}>
                {muniSel?.name}の記録はまだありません。
              </div>
            ) : (
              <div className="pol-row">
                {shownRecords.map((r) => (
                  <PolaroidCard key={r.id} rec={r}
                    onClick={() => setHighlightMuni(recMuni.get(r.id) ?? null)}
                    onOpen={() => onSelectSpot(r)}
                    onHover={(h) => setBlinkMuni(h ? recMuni.get(r.id) ?? null : null)} />
                ))}
              </div>
            )}
          </div>
        )}

        {records.length === 0 && !adding && (
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", textAlign: "center", padding: "34px 20px", lineHeight: 2.2, marginTop: 22, border: "1px dashed var(--ink-faint)" }}>
            この県は、まだ白いままです。<br />
            最初の一枚から、地図を始めましょう。
          </div>
        )}

        </div>
        </div>
      </div>
    </div>
  );
}
