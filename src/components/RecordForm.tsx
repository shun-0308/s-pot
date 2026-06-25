"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { RecordWithPhotos } from "@/lib/records";
import type { Visibility, ScoutInfo } from "@/lib/supabase";
import { PREFECTURES } from "@/lib/prefectures";
import { geocodePlace } from "@/lib/geocode";

const LocationPicker = dynamic(() => import("./LocationPicker"), {
  ssr: false,
  loading: () => <div style={{ height: 260, background: "#EDEDEA", border: "1px solid var(--hairline)" }} />,
});

const DRAFT_KEY = "s-pot-draft-new";

export type FormValues = {
  name: string;
  address: string; // 位置判定に使う住所/場所名(任意)
  taken_at: string; // "YYYY-MM-DD" or ""
  body: string;
  youtube_url: string; // 関連YouTube動画(任意)
  photos: File[]; // 複数枚まとめてアップロードできる
  visibility: Visibility;
  scout: ScoutInfo;
  pref_code?: number | null; // 編集時に都道府県を選び直せる(日本の記録)
  lat?: number | null; // 手動ピン or 自動判定の緯度
  lng?: number | null; // 〃 経度
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
  prefSelectable?: boolean; // 都道府県を選び直せるようにする(日本の記録の編集)
  jpOnly?: boolean; // 住所検索を日本国内に絞る(日本の記録)。海外はfalse
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

export default function RecordForm({ title, initial, existing, prefSelectable, jpOnly = true, busy, onSubmit, onCancel }: Props) {
  const isEdit = !!existing;
  const [v, setV] = useState<FormValues>(() => {
    // 新規作成時のみ下書きを復元
    if (!isEdit) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...parsed, photos: [] }; // Fileオブジェクトは復元不可
        }
      } catch {}
    }
    return {
      name: initial?.name ?? "",
      address: initial?.address ?? "",
      taken_at: initial?.taken_at ?? "",
      body: initial?.body ?? "",
      youtube_url: initial?.youtube_url ?? "",
      photos: initial?.photos ?? [],
      visibility: initial?.visibility ?? "private",
      scout: initial?.scout ?? {},
      pref_code: initial?.pref_code ?? null,
      lat: initial?.lat ?? null,
      lng: initial?.lng ?? null,
    };
  });
  const [scoutOpen, setScoutOpen] = useState(
    !!initial?.scout && Object.values(initial.scout).some(Boolean)
  );
  const [draftRestored, setDraftRestored] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setCoords = (lat: number, lng: number) => setV((p) => ({ ...p, lat, lng }));
  const clearCoords = () => { setV((p) => ({ ...p, lat: null, lng: null })); setGeoMsg(null); };

  // 住所/場所名からピンの初期位置を検索(あくまで候補。ズレたら地図で直せる)
  const searchByText = async () => {
    const q = (v.address.trim() || v.name.trim());
    if (!q) { setGeoMsg("先に住所か場所の名前を入力してください"); return; }
    setGeoBusy(true);
    setGeoMsg(null);
    try {
      const g = await geocodePlace(q, { jpOnly });
      if (g) { setCoords(+g.lat.toFixed(6), +g.lon.toFixed(6)); setGeoMsg("📍 候補の位置に置きました。ズレていれば地図で動かせます"); }
      else setGeoMsg("住所から位置を特定できませんでした。地図をタップしてピンを置いてください");
    } finally {
      setGeoBusy(false);
    }
  };

  // 下書き復元通知
  useEffect(() => {
    if (!isEdit) {
      try {
        if (localStorage.getItem(DRAFT_KEY)) setDraftRestored(true);
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // フォーム変更のたびに下書き自動保存（新規作成のみ）
  useEffect(() => {
    if (isEdit) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { photos, ...saveable } = v;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(saveable));
    } catch {}
  }, [v, isEdit]);

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

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDraftRestored(false);
  };

  const handleSubmit = () => {
    if (!v.name.trim()) return;
    clearDraft();
    onSubmit({ ...v, scout: cleanScout(v.scout) ?? {} });
  };

  return (
    <div className="card" style={{ borderTop: "1px solid var(--ink)", paddingTop: 18, marginTop: 6 }}>
      <div className="caption" style={{ marginBottom: 4 }}>NEW ENTRY</div>
      <div className="tz-serif" style={{ fontWeight: 700, fontSize: 17, marginBottom: 14 }}>{title}</div>

      {/* 下書き復元通知 */}
      {draftRestored && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", marginBottom: 14,
          background: "var(--paper-raise)", border: "1px solid var(--hairline)", fontSize: 12, color: "var(--ink-soft)" }}>
          <span>📝 下書きを復元しました</span>
          <button onClick={() => { clearDraft(); setV({ name: "", address: "", taken_at: "", body: "", youtube_url: "", photos: [], visibility: "private", scout: {}, pref_code: null, lat: null, lng: null }); }}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--ink-faint)", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>
            下書きを削除
          </button>
        </div>
      )}

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
      {prefSelectable && (
        <select style={{ ...inputStyle, appearance: "auto" }} value={v.pref_code ?? ""}
          onChange={(e) => setV((p) => ({ ...p, pref_code: e.target.value ? Number(e.target.value) : null }))}>
          {PREFECTURES.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}
      <input style={inputStyle} placeholder="住所・場所名(例: 東京駅 / 横浜市金沢区 八景島) — 地図の位置判定に使います" value={v.address}
        onChange={(e) => setV((p) => ({ ...p, address: e.target.value }))} />

      {/* 地図で位置を指定(手動ピン) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <div className="caption" style={{ fontSize: 9, margin: 0 }}>地図で位置を指定</div>
          <button type="button" onClick={searchByText} disabled={geoBusy}
            style={{ padding: "5px 11px", fontSize: 11.5, fontFamily: "inherit", cursor: geoBusy ? "default" : "pointer",
              border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink-soft)", letterSpacing: "0.04em", minHeight: 0, opacity: geoBusy ? 0.6 : 1 }}>
            {geoBusy ? "検索中…" : "住所/名前で検索"}
          </button>
          <span style={{ fontSize: 11, color: v.lat != null ? "var(--shu)" : "var(--ink-faint)", letterSpacing: "0.04em" }}>
            {v.lat != null ? "ピン設置済み" : "未設定"}
          </span>
          {v.lat != null && (
            <button type="button" onClick={clearCoords}
              style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3, padding: 2 }}>
              クリア
            </button>
          )}
        </div>
        <LocationPicker lat={v.lat ?? null} lng={v.lng ?? null} onChange={setCoords} />
        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 5, lineHeight: 1.7 }}>
          地図を<b>タップ</b>でピンを設置・<b>ドラッグ</b>で微調整できます。住所で出ない場所もこれで確実に地図へ載ります。
        </div>
        {geoMsg && (
          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 5, lineHeight: 1.6 }}>{geoMsg}</div>
        )}
      </div>

      <input style={inputStyle} type="date" value={v.taken_at}
        onChange={(e) => setV((p) => ({ ...p, taken_at: e.target.value }))} />
      <textarea style={{ ...inputStyle, resize: "vertical", lineHeight: 1.9 }} rows={5}
        placeholder="記録文 — その日の光、音、気づいたこと…" value={v.body}
        onChange={(e) => setV((p) => ({ ...p, body: e.target.value }))} />
      <input style={inputStyle} type="url" inputMode="url"
        placeholder="動画・リンクのURL(任意・YouTubeは埋め込み再生／Instagram等はリンク表示)" value={v.youtube_url}
        onChange={(e) => setV((p) => ({ ...p, youtube_url: e.target.value }))} />

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
        <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 12, lineHeight: 1.7,
          padding: "10px 12px", border: "1px solid var(--hairline)", background: "var(--paper-raise)" }}>
          <div style={{ marginBottom: 6 }}>※ 公開時もGPS座標は共有されません（県までの表示）</div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--ink-soft)" }}>投稿ガイドライン</div>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
            {[
              "旅・撮影に関連する場所の記録を投稿してください",
              "他の会員のプライバシーに配慮した内容にしてください",
              "広告・宣伝目的の投稿はご遠慮ください",
            ].map((g) => (
              <li key={g} style={{ display: "flex", gap: 6 }}>
                <span style={{ color: "var(--shu)", flexShrink: 0 }}>·</span>{g}
              </li>
            ))}
          </ul>
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
        <button onClick={handleSubmit} disabled={busy || !v.name.trim()}
          style={{ padding: "11px 26px", border: "none", background: "var(--shu)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.14em", opacity: busy || !v.name.trim() ? 0.5 : 1 }}>
          {busy ? "保存中…" : "記録する"}
        </button>
      </div>
    </div>
  );
}
