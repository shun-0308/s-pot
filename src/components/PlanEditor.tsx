"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecordWithPhotos } from "@/lib/records";
import type { ClipRow } from "@/lib/clips";
import {
  fetchPlan, updatePlan, addPlanItem, removePlanItem, updatePlanItem, reorderPlanItems,
  type PlanWithItems, type PlanItemRow, type PlanItemInput,
} from "@/lib/plans";
import { geocodeCandidates, type GeoCandidate } from "@/lib/geocode";
import type { Visibility } from "@/lib/supabase";
import { prefByCode, captionOf } from "@/lib/prefectures";
import { JAPAN_CODE } from "@/lib/world";
import PlanMap from "./PlanMap";
import JapanMap from "./JapanMap";
import Photo from "./Photo";
import LocationPicker from "./LocationPicker";

type Props = {
  planId: string;
  records: RecordWithPhotos[];          // 自分の記録
  favoriteRecords: RecordWithPhotos[];  // みんなの図鑑で♡した他人の記録も含む
  clips: ClipRow[];
  onBack: () => void;
  onChanged?: () => void;               // プラン一覧の件数・更新日を反映
};

const VIS_LABEL: Record<Visibility, string> = {
  private: "自分だけ", members: "会員に公開", public: "リンクを知る人に公開",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid var(--hairline)",
  background: "var(--paper)", color: "var(--ink)", fontSize: 14, fontFamily: "inherit",
  borderRadius: 4, boxSizing: "border-box",
};
const capStyle: React.CSSProperties = { fontSize: 9.5, letterSpacing: "0.26em", color: "var(--ink-faint)" };

export default function PlanEditor({ planId, records, favoriteRecords, clips, onBack, onChanged }: Props) {
  const [plan, setPlan] = useState<PlanWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editMeta, setEditMeta] = useState(false);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // メタ編集用の一時state
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState("");
  const [vis, setVis] = useState<Visibility>("private");

  const load = useCallback(async () => {
    try {
      const p = await fetchPlan(planId);
      setPlan(p);
      if (p) { setTitle(p.title); setDesc(p.description ?? ""); setDate(p.plan_date ?? ""); setVis(p.visibility); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "プランの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [planId]);
  useEffect(() => { load(); }, [load]);

  const items = plan?.items ?? [];
  const mapPoints = useMemo(
    () => items.filter((i) => i.lat != null && i.lng != null).map((i) => ({ id: i.id, name: i.name, lat: i.lat!, lng: i.lng! })),
    [items]
  );

  const saveMeta = async () => {
    if (!title.trim()) { setErr("タイトルを入力してください"); return; }
    setBusy(true); setErr(null);
    try {
      await updatePlan(planId, { title: title.trim(), description: desc.trim() || null, plan_date: date || null, visibility: vis });
      await load();
      onChanged?.();
      setEditMeta(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally { setBusy(false); }
  };

  const handleAdd = async (input: PlanItemInput) => {
    setBusy(true); setErr(null);
    try {
      const nextSort = items.length ? Math.max(...items.map((i) => i.sort)) + 1 : 0;
      await addPlanItem(planId, input, nextSort);
      await load();
      onChanged?.();
      setAdding(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "追加に失敗しました");
    } finally { setBusy(false); }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const reordered = [...items];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    // 楽観更新
    setPlan((p) => (p ? { ...p, items: reordered.map((it, k) => ({ ...it, sort: k })) } : p));
    try {
      await reorderPlanItems(reordered.map((it, k) => ({ id: it.id, sort: k })));
      onChanged?.();
    } catch { await load(); }
  };

  const remove = async (id: string) => {
    setPlan((p) => (p ? { ...p, items: p.items.filter((i) => i.id !== id) } : p));
    try { await removePlanItem(id); onChanged?.(); } catch { await load(); }
  };

  const saveItemField = async (id: string, patch: Partial<Pick<PlanItemRow, "note" | "planned_time">>) => {
    setPlan((p) => (p ? { ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : p));
    try { await updatePlanItem(id, patch); } catch { /* 失敗時は次回ロードで戻る */ }
  };

  // 地図ピンで実座標を確定(より正確に)。順路マップ・警告も即反映。
  const saveItemCoords = async (id: string, lat: number, lng: number) => {
    setPlan((p) => (p ? { ...p, items: p.items.map((i) => (i.id === id ? { ...i, lat, lng } : i)) } : p));
    try { await updatePlanItem(id, { lat, lng }); } catch { await load(); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>読み込み中…</div>;
  if (!plan) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>
      プランが見つかりませんでした。
      <div style={{ marginTop: 16 }}><button onClick={onBack} style={linkBtn}>← 戻る</button></div>
    </div>
  );

  return (
    <div style={{ padding: "24px 18px 90px" }}>
      <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
        <button onClick={onBack} style={linkBtn}>← お出かけプラン</button>

        {/* ── ヘッダー(メタ) ── */}
        {!editMeta ? (
          <div style={{ marginTop: 16 }}>
            <div style={capStyle}>TRIP PLAN{plan.visibility !== "private" ? " · 公開中" : ""}</div>
            <h2 className="tz-serif" style={{ fontSize: 25, fontWeight: 700, margin: "3px 0 4px", letterSpacing: "0.06em" }}>{plan.title}</h2>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", letterSpacing: "0.06em" }}>
              {plan.plan_date ? plan.plan_date.replaceAll("-", ".") : "日付未定"} · {items.length}スポット · {VIS_LABEL[plan.visibility]}
            </div>
            {plan.description && <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.9, marginTop: 10, whiteSpace: "pre-wrap" }}>{plan.description}</p>}
            {plan.visibility !== "private" && (
              <div style={{ marginTop: 12, padding: "10px 12px", border: "1px solid #C9A86A", background: "rgba(201,168,106,0.1)", borderRadius: 6, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8 }}>
                {plan.visibility === "members"
                  ? "✨ 会員に公開中 — このプランは「みんなのプラン」に並び、写真つきでみんなが参考にできます。"
                  : "🔗 リンク公開中 — このプランは公開状態です。"}
                {" "}記録由来のスポットの写真も一緒に共有されます（非公開の記録の写真は出ません）。
              </div>
            )}
            <button onClick={() => setEditMeta(true)} style={{ ...linkBtn, marginTop: 10, fontSize: 12 }}>タイトル・日付・公開設定を編集</button>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <div><div style={capStyle}>タイトル</div><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 京都ぶらり一日旅" /></div>
            <div><div style={capStyle}>予定日(任意)</div><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><div style={capStyle}>ひとこと説明(任意)</div><textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <div>
              <div style={capStyle}>公開設定</div>
              <select style={inputStyle} value={vis} onChange={(e) => setVis(e.target.value as Visibility)}>
                <option value="private">自分だけ</option>
                <option value="members">会員に公開（みんなのプランに載る）</option>
                <option value="public">リンクを知る人に公開</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveMeta} disabled={busy} style={primaryBtn}>保存</button>
              <button onClick={() => { setEditMeta(false); setTitle(plan.title); setDesc(plan.description ?? ""); setDate(plan.plan_date ?? ""); setVis(plan.visibility); }} style={ghostBtn}>キャンセル</button>
            </div>
          </div>
        )}

        {err && <div style={{ marginTop: 12, padding: "8px 12px", borderLeft: "2px solid var(--shu)", fontSize: 12.5, color: "var(--shu)" }}>{err}</div>}

        {/* ── 地図(順路) ── */}
        {items.length > 0 && (
          <div style={{ margin: "18px -18px 0" }}>
            <PlanMap points={mapPoints} height={300} />
          </div>
        )}

        {/* ── 行き先リスト ── */}
        <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={capStyle}>ITINERARY — 行き先</div>
          <button onClick={() => setAdding(true)} style={primaryBtn}>＋ スポットを追加</button>
        </div>

        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-soft)", textAlign: "center", padding: "36px 20px", lineHeight: 2, border: "1px dashed var(--ink-faint)", marginTop: 14 }}>
            まだスポットがありません。<br />「＋ スポットを追加」から、行きたい場所を並べていきましょう。
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {items.map((it, idx) => (
              <ItemRow key={it.id} item={it} idx={idx} total={items.length} busy={busy}
                onMove={move} onRemove={remove} onSaveField={saveItemField} onSaveCoords={saveItemCoords} />
            ))}
          </div>
        )}
      </div>

      {adding && (
        <AddItemModal
          records={records} favoriteRecords={favoriteRecords} clips={clips}
          existingRecordIds={new Set(items.map((i) => i.record_id).filter(Boolean) as string[])}
          onClose={() => setAdding(false)} onAdd={handleAdd} busy={busy}
        />
      )}
    </div>
  );
}

// ── 1行 ──────────────────────────────────────────────
function ItemRow({ item, idx, total, busy, onMove, onRemove, onSaveField, onSaveCoords }: {
  item: PlanItemRow; idx: number; total: number; busy: boolean;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onSaveField: (id: string, patch: { note?: string | null; planned_time?: string | null }) => void;
  onSaveCoords: (id: string, lat: number, lng: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [note, setNote] = useState(item.note ?? "");
  const [time, setTime] = useState(item.planned_time ?? "");
  const [gq, setGq] = useState("");
  const [gcands, setGcands] = useState<GeoCandidate[] | null>(null);
  const [gbusy, setGbusy] = useState(false);

  const runGeo = async () => {
    const query = gq.trim();
    if (!query) return;
    setGbusy(true); setGcands(null);
    try { setGcands(await geocodeCandidates(query)); } finally { setGbusy(false); }
  };

  return (
    <div style={{ borderBottom: "1px solid var(--hairline)", padding: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--shu)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "Georgia, serif", marginTop: 1 }}>{idx + 1}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tz-serif" style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.5 }}>
            {item.planned_time && <span style={{ color: "var(--shu)", marginRight: 8, fontSize: 13 }}>{item.planned_time}</span>}
            {item.name}
          </div>
          {item.address && <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 2 }}>{item.address}</div>}
          {item.note && <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.8, marginTop: 4, whiteSpace: "pre-wrap" }}>{item.note}</div>}
          {item.lat != null ? (
            <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>📍 {item.lat.toFixed(5)}, {item.lng!.toFixed(5)}</div>
          ) : (
            <button onClick={() => setLocOpen(true)} style={{ ...miniBtn, color: "var(--shu)", marginTop: 4, display: "block" }}>※ 位置未設定 — 地図でピンを置く</button>
          )}
          <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
            <button onClick={() => setOpen(!open)} style={miniBtn}>{open ? "閉じる" : "メモ・時刻"}</button>
            <button onClick={() => setLocOpen(!locOpen)} style={miniBtn}>{locOpen ? "地図を閉じる" : "地図で位置を調整"}</button>
          </div>
          {open && (
            <div style={{ display: "grid", gap: 8, marginTop: 8, paddingLeft: 2 }}>
              <input style={{ ...inputStyle, padding: "8px 10px", fontSize: 13 }} placeholder="時刻 (例 10:00)" value={time}
                onChange={(e) => setTime(e.target.value)} onBlur={() => onSaveField(item.id, { planned_time: time.trim() || null })} />
              <textarea style={{ ...inputStyle, padding: "8px 10px", fontSize: 13, minHeight: 52, resize: "vertical" }} placeholder="メモ（予約・持ち物・ひとことなど）" value={note}
                onChange={(e) => setNote(e.target.value)} onBlur={() => onSaveField(item.id, { note: note.trim() || null })} />
            </div>
          )}
          {locOpen && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input style={{ ...inputStyle, padding: "8px 10px", fontSize: 13 }} placeholder="地名・住所で移動（例: 清水寺）" value={gq}
                  onChange={(e) => setGq(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runGeo()} />
                <button onClick={runGeo} disabled={gbusy} style={{ ...primaryBtn, whiteSpace: "nowrap" }}>{gbusy ? "…" : "検索"}</button>
              </div>
              {gcands && (gcands.length === 0
                ? <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginBottom: 8 }}>見つかりませんでした。地図を直接タップしても置けます。</div>
                : <div style={{ marginBottom: 8 }}>
                    {gcands.map((c, i) => (
                      <button key={i} onClick={() => { onSaveCoords(item.id, c.lat, c.lon); setGcands(null); setGq(""); }}
                        style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--hairline)", padding: "8px 4px", fontSize: 12.5, color: "var(--ink)", cursor: "pointer", fontFamily: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "var(--shu)", marginRight: 6 }}>📍</span>{c.label}
                      </button>
                    ))}
                  </div>)}
              <LocationPicker lat={item.lat} lng={item.lng} height={220} onChange={(la, ln) => onSaveCoords(item.id, la, ln)} />
              <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 5, lineHeight: 1.7 }}>
                タップで設置・ドラッグで微調整。確定した実緯度経度（小数6桁）で保存され、順路マップに反映されます。
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
          <button onClick={() => onMove(idx, -1)} disabled={busy || idx === 0} style={arrowBtn(idx === 0)} aria-label="上へ">↑</button>
          <button onClick={() => onMove(idx, 1)} disabled={busy || idx === total - 1} style={arrowBtn(idx === total - 1)} aria-label="下へ">↓</button>
          <button onClick={() => onRemove(item.id)} style={{ ...miniBtn, color: "var(--shu)", marginTop: 4 }} aria-label="削除">×</button>
        </div>
      </div>
    </div>
  );
}

// ── スポット追加モーダル ───────────────────────────────
function AddItemModal({ records, favoriteRecords, clips, existingRecordIds, onClose, onAdd, busy }: {
  records: RecordWithPhotos[];
  favoriteRecords: RecordWithPhotos[];
  clips: ClipRow[];
  existingRecordIds: Set<string>;
  onClose: () => void;
  onAdd: (input: PlanItemInput) => void;
  busy: boolean;
}) {
  const [tab, setTab] = useState<"clip" | "record" | "map" | "search">("clip");
  const [q, setQ] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [cands, setCands] = useState<GeoCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [mapPref, setMapPref] = useState<number | null>(null); // 日本地図タブで選んだ県

  // 記録ソース(自分＋♡他人)を重複排除
  const selectableRecords = useMemo(() => {
    const map = new Map<string, RecordWithPhotos>();
    for (const r of [...records, ...favoriteRecords]) map.set(r.id, r);
    return [...map.values()];
  }, [records, favoriteRecords]);

  const filteredRecords = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return selectableRecords.filter((r) => !kw || r.name.toLowerCase().includes(kw) || (r.address ?? "").toLowerCase().includes(kw));
  }, [selectableRecords, q]);

  // 県コード→記録数(日本地図の色づけ用。日本の記録のみ)
  const prefCounts = useMemo(() => {
    const c: Record<number, number> = {};
    for (const r of selectableRecords)
      if (r.country_code === JAPAN_CODE && r.pref_code != null) c[r.pref_code] = (c[r.pref_code] ?? 0) + 1;
    return c;
  }, [selectableRecords]);

  // 選んだ県の記録(カード表示用)
  const prefRecords = useMemo(
    () => (mapPref == null ? [] : selectableRecords.filter((r) => r.country_code === JAPAN_CODE && r.pref_code === mapPref)),
    [selectableRecords, mapPref]
  );

  const runSearch = async () => {
    const query = searchQ.trim();
    if (!query) return;
    setSearching(true); setCands(null);
    try { setCands(await geocodeCandidates(query)); } finally { setSearching(false); }
  };

  const tabBtn = (key: typeof tab, label: string) => (
    <button onClick={() => { setTab(key); setMapPref(null); }} style={{
      flex: 1, padding: "9px 4px", border: "none", borderBottom: tab === key ? "2px solid var(--shu)" : "2px solid transparent",
      background: "none", color: tab === key ? "var(--ink)" : "var(--ink-faint)", fontWeight: tab === key ? 700 : 400,
      fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em",
    }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(7,8,12,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", maxHeight: "82vh", background: "var(--paper)", borderRadius: "14px 14px 0 0", display: "flex", flexDirection: "column", boxShadow: "0 -10px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "16px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="tz-serif" style={{ fontSize: 17, fontWeight: 700 }}>スポットを追加</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "var(--ink-faint)", cursor: "pointer", padding: 4 }}>×</button>
        </div>
        <div style={{ display: "flex", margin: "10px 0 0", borderBottom: "1px solid var(--hairline)" }}>
          {tabBtn("clip", `クリップ(${clips.length})`)}
          {tabBtn("record", "記録")}
          {tabBtn("map", "日本地図")}
          {tabBtn("search", "検索")}
        </div>

        <div style={{ overflowY: "auto", padding: "12px 16px 24px" }}>
          {tab === "clip" && (
            clips.length === 0 ? (
              <Empty>クリップした場所がありません。気になる場所を🚩でクリップすると、ここから追加できます。</Empty>
            ) : (
              clips.map((c) => (
                <PickRow key={c.id} title={c.name} sub={c.address ?? (c.lat != null ? "地図あり" : "位置なし")} busy={busy}
                  onPick={() => onAdd({ record_id: c.record_id, name: c.name, address: c.address, lat: c.lat, lng: c.lng, note: c.note })} />
              ))
            )
          )}

          {tab === "record" && (
            <>
              <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="記録名・住所でしぼり込み" value={q} onChange={(e) => setQ(e.target.value)} />
              {filteredRecords.length === 0 ? <Empty>該当する記録がありません。</Empty> :
                filteredRecords.map((r) => (
                  <PickRow key={r.id} title={r.name} sub={(r.address ?? "") + (existingRecordIds.has(r.id) ? "（追加済み）" : "")} busy={busy}
                    onPick={() => onAdd({ record_id: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng })} />
                ))}
            </>
          )}

          {tab === "map" && (
            mapPref == null ? (
              <>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", textAlign: "center", padding: "2px 8px 10px", lineHeight: 1.8 }}>
                  色のついた県をタップ → その県の記録カードから選べます。
                </div>
                <JapanMap counts={prefCounts} onSelect={(p) => setMapPref(p.id)} />
              </>
            ) : (
              <>
                <button onClick={() => setMapPref(null)} style={{ ...linkBtn, marginBottom: 8, fontSize: 12.5 }}>← 日本地図へ</button>
                <div className="tz-serif" style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
                  {prefByCode(mapPref)?.name ?? ""}<span style={{ fontSize: 12, color: "var(--ink-faint)", fontWeight: 400, marginLeft: 8 }}>{prefRecords.length}件</span>
                </div>
                {prefRecords.length === 0 ? (
                  <Empty>この県の記録がありません。別の県を選んでみてください。</Empty>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {prefRecords.map((r) => {
                      const added = existingRecordIds.has(r.id);
                      return (
                        <button key={r.id} onClick={() => onAdd({ record_id: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng })} disabled={busy}
                          style={{ display: "flex", gap: 11, textAlign: "left", background: "var(--paper-raise)", border: "1px solid var(--hairline)", borderRadius: 8, padding: 8, cursor: busy ? "default" : "pointer", fontFamily: "inherit", alignItems: "center" }}>
                          <span style={{ width: 60, height: 60, flexShrink: 0, borderRadius: 6, overflow: "hidden" }}><Photo rec={r} w={60} h={60} /></span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "block", fontSize: 9, letterSpacing: "0.1em", color: "var(--ink-faint)" }}>{captionOf(r.pref_code, r.taken_at)}</span>
                            <span className="tz-serif" style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{r.name}</span>
                            {added && <span style={{ display: "block", fontSize: 11, color: "var(--shu)", marginTop: 2 }}>追加済み</span>}
                          </span>
                          <span style={{ color: "var(--shu)", fontSize: 18, flexShrink: 0 }}>＋</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )
          )}

          {tab === "search" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input style={inputStyle} placeholder="カフェ・観光地・住所などで検索" value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} />
                <button onClick={runSearch} disabled={searching} style={{ ...primaryBtn, whiteSpace: "nowrap" }}>{searching ? "…" : "検索"}</button>
              </div>
              {cands == null ? <Empty>行きたい場所を検索して、地図つきで追加できます。</Empty> :
                cands.length === 0 ? <Empty>見つかりませんでした。別の言い方で試してみてください。</Empty> :
                cands.map((c, i) => (
                  <PickRow key={i} title={c.label} sub="この場所を追加" busy={busy}
                    onPick={() => onAdd({ name: c.label, address: c.label, lat: c.lat, lng: c.lon })} />
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PickRow({ title, sub, onPick, busy }: { title: string; sub?: string; onPick: () => void; busy: boolean }) {
  return (
    <button onClick={onPick} disabled={busy} style={{
      width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "11px 6px",
      borderBottom: "1px solid var(--hairline)", background: "none", border: "none", cursor: busy ? "default" : "pointer", fontFamily: "inherit",
    }}>
      <span style={{ color: "var(--shu)", fontSize: 18, flexShrink: 0 }}>＋</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 14, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
      </span>
    </button>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 12.5, color: "var(--ink-soft)", textAlign: "center", padding: "28px 16px", lineHeight: 1.9 }}>{children}</div>
);

const linkBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.08em" };
const primaryBtn: React.CSSProperties = { padding: "9px 16px", border: "none", background: "var(--shu)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em", borderRadius: 4 };
const ghostBtn: React.CSSProperties = { padding: "9px 16px", border: "1px solid var(--ink-faint)", background: "transparent", color: "var(--ink)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", borderRadius: 4 };
const miniBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.04em" };
const arrowBtn = (disabled: boolean): React.CSSProperties => ({ background: "none", border: "1px solid var(--hairline)", color: disabled ? "var(--ink-faint)" : "var(--ink)", width: 26, height: 24, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, borderRadius: 3, opacity: disabled ? 0.4 : 1 });
