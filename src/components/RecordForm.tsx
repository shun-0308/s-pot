"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RecordWithPhotos } from "@/lib/records";
import type { Visibility, ScoutInfo } from "@/lib/supabase";

export type FormValues = {
  name: string;
  taken_at: string; // "YYYY-MM-DD" or ""
  body: string;
  photos: File[]; // 複数枚まとめてアップロードできる
  visibility: Visibility;
  scout: ScoutInfo;
};

const SCOUT_TIMES = ["朝焼け", "午前", "午後", "夕暮れ", "夜景"];
const SCOUT_TRIPOD = ["可", "条件付き", "不可"];
const SCOUT_PERMIT = ["不要", "要確認", "要申請"];

// 空のロケハン情報はnullに正規化
const cleanScout = (s: ScoutInfo): ScoutInfo | null => {
  const entries = Object.entries(s).filter(([, v]) => v && String(v).trim());
  return entries.length ? (Object.fromEntries(entries) as ScoutInfo) : null;
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "自分だけ",
  members: "会員に公開",
  public: "リンク公開",
};

type Props = {
  title: string;
  initial?: Partial<FormValues>;
  existing?: RecordWithPhotos | null; // 編集時(既存写真の表示用)
  busy: boolean;
  onSubmit: (v: FormValues) => void;
  onCancel: () => void;
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "11px 12px",
  borderRadius: 0,
  border: "1px solid var(--hairline)",
  fontFamily: "inherit",
  fontSize: 14,
  marginBottom: 10,
  background: "var(--paper-raise)",
  color: "var(--ink)",
};

export default function RecordForm({ title, initial, existing, busy, onSubmit, onCancel }: Props) {
  const [v, setV] = useState<FormValues>({
    name: initial?.name ?? "",
    taken_at: initial?.taken_at ?? "",
    body: initial?.body ?? "",
    photos: initial?.photos ?? [],
    visibility: initial?.visibility ?? "private",
    scout: initial?.scout ?? {},
  });
  const [scoutOpen, setScoutOpen] = useState(
    !!initial?.scout && Object.values(initial.scout).some(Boolean)
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const setScout = (k: keyof ScoutInfo, val: string | undefined) =>
    setV((p) => ({ ...p, scout: { ...p.scout, [k]: val } }));

  const Chip = ({ k, val }: { k: keyof ScoutInfo; val: string }) => {
    const on = v.scout[k] === val;
    return (
      <button onClick={() => setScout(k, on ? undefined : val)}
        style={{ padding: "6px 11px", fontSize: 11.5, fontFamily: "inherit", cursor: "pointer",
          border: on ? "1px solid var(--shu)" : "1px solid var(--hairline)",
          background: on ? "var(--shu)" : "transparent",
          color: on ? "#fff" : "var(--ink-faint)", letterSpacing: "0.04em", minHeight: 0 }}>
        {val}
      </button>
    );
  };
  const ScoutCap = ({ children }: { children: React.ReactNode }) => (
    <div className="caption" style={{ fontSize: 9, margin: "10px 0 5px" }}>{children}</div>
  );

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    // 既存の選択に追加(複数回に分けて選んでも貯まる)
    setV((p) => ({ ...p, photos: [...p.photos, ...files] }));
    e.target.value = ""; // 同じファイルを選び直せるようにリセット
  };
  const removePhoto = (i: number) =>
    setV((p) => ({ ...p, photos: p.photos.filter((_, j) => j !== i) }));

  // 選択中ファイルのプレビューURL(変更時に作り直し、後片付けも)
  const previews = useMemo(
    () => v.photos.map((f) => URL.createObjectURL(f)),
    [v.photos]
  );
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const existingPhotos = existing?.photos.map((p) => p.url).filter(Boolean) as string[] | undefined;

  return (
    <div className="card" style={{ borderTop: "1px solid var(--ink)", paddingTop: 18, marginTop: 6 }}>
      <div className="caption" style={{ marginBottom: 4 }}>NEW ENTRY</div>
      <div className="tz-serif" style={{ fontWeight: 700, fontSize: 17, marginBottom: 14 }}>{title}</div>

      {/* 既存写真(編集時)。差し替えではなく追加なので残して表示 */}
      {existingPhotos && existingPhotos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 6, marginBottom: 10 }}>
          {existingPhotos.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={"e" + i} src={u} alt="" style={{ width: "100%", height: 96, objectFit: "cover", display: "block", borderRadius: 2 }} />
          ))}
        </div>
      )}

      {/* これからアップロードする写真(複数可・個別に外せる) */}
      {previews.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 6, marginBottom: 12 }}>
          {previews.map((u, i) => (
            <div key={"n" + i} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" style={{ width: "100%", height: 96, objectFit: "cover", display: "block", borderRadius: 2 }} />
              <button onClick={() => removePhoto(i)} aria-label="この写真を外す"
                style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, lineHeight: "18px", textAlign: "center", padding: 0, border: "none", borderRadius: "50%", background: "rgba(46,42,37,0.72)", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <input style={inputStyle} placeholder="場所の名前(例: 尾道・千光寺)" value={v.name}
        onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))} />
      <input style={inputStyle} type="date" value={v.taken_at}
        onChange={(e) => setV((p) => ({ ...p, taken_at: e.target.value }))} />
      <textarea style={{ ...inputStyle, resize: "vertical", lineHeight: 1.9 }} rows={5}
        placeholder="記録文 — その日の光、音、気づいたこと…" value={v.body}
        onChange={(e) => setV((p) => ({ ...p, body: e.target.value }))} />

      {/* 公開範囲(デフォルトは自分だけ) */}
      <div style={{ display: "flex", gap: 0, marginBottom: 10, border: "1px solid var(--hairline)" }}>
        {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((k, i) => (
          <button key={k} onClick={() => setV((p) => ({ ...p, visibility: k }))}
            style={{
              flex: 1, padding: "9px 4px", fontSize: 12, fontFamily: "inherit", cursor: "pointer",
              border: "none", borderLeft: i ? "1px solid var(--hairline)" : "none",
              background: v.visibility === k ? "var(--ink)" : "transparent",
              color: v.visibility === k ? "var(--paper)" : "var(--ink-faint)",
              letterSpacing: "0.06em",
            }}>
            {VISIBILITY_LABEL[k]}
          </button>
        ))}
      </div>
      {v.visibility !== "private" && (
        <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 12, lineHeight: 1.7 }}>
          ※ 公開時もGPS座標は共有されません(県までの表示)
        </div>
      )}

      {/* ロケハン情報(任意) */}
      {!scoutOpen ? (
        <button onClick={() => setScoutOpen(true)}
          style={{ width: "100%", padding: 11, border: "1px dashed var(--ink-faint)", background: "transparent", color: "var(--ink-soft)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em", marginBottom: 10 }}>
          ＋ ロケハン情報を追加(任意)
        </button>
      ) : (
        <div style={{ border: "1px solid var(--hairline)", padding: "10px 12px 14px", marginBottom: 10, background: "rgba(255,254,251,0.6)" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div className="caption" style={{ fontSize: 9.5 }}>LOCATION SCOUTING — ロケハン</div>
            <button onClick={() => setScoutOpen(false)}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--ink-faint)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", minHeight: 0, padding: 2 }}>
              閉じる
            </button>
          </div>
          <ScoutCap>ベスト時間帯</ScoutCap>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {SCOUT_TIMES.map((t) => <Chip key={t} k="best_time" val={t} />)}
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div>
              <ScoutCap>三脚</ScoutCap>
              <div style={{ display: "flex", gap: 5 }}>
                {SCOUT_TRIPOD.map((t) => <Chip key={t} k="tripod" val={t} />)}
              </div>
            </div>
            <div>
              <ScoutCap>撮影許可</ScoutCap>
              <div style={{ display: "flex", gap: 5 }}>
                {SCOUT_PERMIT.map((t) => <Chip key={t} k="permit" val={t} />)}
              </div>
            </div>
          </div>
          <ScoutCap>光のメモ</ScoutCap>
          <input style={{ ...inputStyle, marginBottom: 0 }} placeholder="例: 夕方は海側から逆光。午前が順光"
            value={v.scout.light ?? ""} onChange={(e) => setScout("light", e.target.value)} />
          <ScoutCap>駐車場・アクセス</ScoutCap>
          <input style={{ ...inputStyle, marginBottom: 0 }} placeholder="例: 北側に無料P10台。徒歩5分"
            value={v.scout.access ?? ""} onChange={(e) => setScout("access", e.target.value)} />
          <ScoutCap>機材・混雑・その他</ScoutCap>
          <textarea style={{ ...inputStyle, marginBottom: 0, resize: "vertical" }} rows={2}
            placeholder="例: 16-35mm必須。週末は三脚の場所取り激戦"
            value={v.scout.notes ?? ""} onChange={(e) => setScout("notes", e.target.value)} />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
        <button onClick={() => fileRef.current?.click()}
          style={{ padding: "10px 16px", border: "1px dashed var(--ink-faint)", background: "transparent", color: "var(--ink-soft)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}>
          {v.photos.length ? `写真 ${v.photos.length}枚 ✓ ・追加で選ぶ` : "写真を選ぶ(複数可)"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} disabled={busy}
          style={{ padding: "10px 8px", border: "none", background: "transparent", color: "var(--ink-faint)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
          やめる
        </button>
        <button onClick={() => v.name.trim() && onSubmit({ ...v, scout: cleanScout(v.scout) ?? {} })} disabled={busy || !v.name.trim()}
          style={{ padding: "11px 26px", border: "none", background: "var(--shu)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.14em", opacity: busy || !v.name.trim() ? 0.5 : 1 }}>
          {busy ? "保存中…" : "記録する"}
        </button>
      </div>
    </div>
  );
}
