"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { avatarUrl, uploadAvatar } from "@/lib/profiles";
import AvatarCropper from "./AvatarCropper";

type Props = {
  onClose: () => void;
};

// 編集できるプロフィール項目
type ProfileForm = {
  display_name: string;
  bio: string;
  area: string;
  instagram: string;
  website: string;
  gear: string;
};

const EMPTY: ProfileForm = { display_name: "", bio: "", area: "", instagram: "", website: "", gear: "" };

// 金(ゴールド)アクセント
const GOLD = "#C9A86A";
const GOLD_SOFT = "#E3C58C";

export default function ProfileSettings({ onClose }: Props) {
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [original, setOriginal] = useState<ProfileForm>(EMPTY);
  const [avatar, setAvatar] = useState<string | null>(null); // 表示用URL
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [hasStripe, setHasStripe] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, bio, area, instagram, website, gear, avatar_path, stripe_customer_id")
        .eq("id", user.id)
        .single();
      const loaded: ProfileForm = {
        display_name: data?.display_name ?? "",
        bio: data?.bio ?? "",
        area: data?.area ?? "",
        instagram: data?.instagram ?? "",
        website: data?.website ?? "",
        gear: data?.gear ?? "",
      };
      setForm(loaded);
      setOriginal(loaded);
      setAvatar(avatarUrl(data?.avatar_path));
      setHasStripe(!!data?.stripe_customer_id);
    })();
  }, []);

  const set = (k: keyof ProfileForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = (Object.keys(form) as (keyof ProfileForm)[]).some((k) => form[k].trim() !== original[k].trim());

  // 写真を選んだら、まず切り抜きエディタを開く
  const pickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) { setMsg(null); setCropFile(file); }
  };

  // 切り抜き確定 → アップロード
  const handleCropped = async (blob: Blob) => {
    setCropFile(null);
    const localUrl = URL.createObjectURL(blob);
    setAvatar(localUrl); // 即時プレビュー
    setAvatarBusy(true);
    setMsg(null);
    try {
      const path = await uploadAvatar(blob);
      setAvatar(avatarUrl(path));
      setMsg({ type: "ok", text: "顔写真を更新しました" });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "画像の保存に失敗しました" });
    } finally {
      URL.revokeObjectURL(localUrl);
      setAvatarBusy(false);
    }
  };

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } finally {
      setPortalBusy(false);
    }
  };

  const save = async () => {
    const name = form.display_name.trim();
    if (!name) { setMsg({ type: "err", text: "表示名を入力してください" }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未ログイン");
      const payload = {
        display_name: name,
        bio: form.bio.trim() || null,
        area: form.area.trim() || null,
        instagram: form.instagram.trim() || null,
        website: form.website.trim() || null,
        gear: form.gear.trim() || null,
      };
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
      setOriginal({ ...form, display_name: name });
      setMsg({ type: "ok", text: "保存しました" });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "保存に失敗しました" });
    } finally {
      setBusy(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10, letterSpacing: "0.22em", color: GOLD,
    margin: "18px 0 7px", textTransform: "uppercase",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    border: "1px solid var(--hairline-dark)", background: "rgba(255,255,255,0.035)",
    padding: "11px 13px", fontSize: 14, fontFamily: "inherit", color: "var(--dark-strong)",
    outline: "none", borderRadius: 2,
  };

  const initial = form.display_name ? form.display_name.charAt(0) : "?";

  return (
    <>
      {/* 背景 */}
      <div onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(5,6,10,0.72)", backdropFilter: "blur(2px)" }} />

      {/* モーダル */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        zIndex: 91, width: "min(440px, 92vw)", maxHeight: "90vh", overflowY: "auto",
        background: "linear-gradient(180deg, #1A1D27 0%, #111219 100%)",
        border: "1px solid rgba(201,168,106,0.22)", borderRadius: 6,
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        padding: "0 0 28px",
      }}>
        {/* ヘッダー(金の罫線) */}
        <div style={{
          position: "sticky", top: 0, zIndex: 2,
          padding: "22px 26px 16px",
          background: "linear-gradient(180deg, #1A1D27 60%, rgba(26,29,39,0))",
          borderBottom: "1px solid rgba(201,168,106,0.16)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: GOLD }}>TRAVELER PROFILE</div>
            <h2 className="tz-serif" style={{ fontSize: 21, fontWeight: 700, margin: "5px 0 0", letterSpacing: "0.1em", color: "var(--dark-strong)" }}>
              プロフィール
            </h2>
          </div>
          <button onClick={onClose} aria-label="閉じる"
            style={{ background: "none", border: "none", color: "var(--dark-faint)", fontSize: 22, cursor: "pointer", fontFamily: "inherit", padding: 2, lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ padding: "0 26px" }}>
          {/* アバター */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "20px 0 6px" }}>
            <div style={{ position: "relative", width: 104, height: 104 }}>
              <div style={{
                width: 104, height: 104, borderRadius: "50%",
                padding: 3, background: `conic-gradient(from 210deg, ${GOLD}, ${GOLD_SOFT}, #8C6E3F, ${GOLD})`,
                boxShadow: "0 6px 22px rgba(0,0,0,0.5)",
              }}>
                <div style={{
                  width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden",
                  background: "#0E0F15", display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid #0E0F15",
                }}>
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="顔写真" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: avatarBusy ? 0.55 : 1 }} />
                  ) : (
                    <span className="tz-serif" style={{ fontSize: 34, fontWeight: 700, color: GOLD_SOFT }}>{initial}</span>
                  )}
                </div>
              </div>
              {/* カメラボタン */}
              <button onClick={() => fileRef.current?.click()} disabled={avatarBusy} aria-label="顔写真を変更"
                style={{
                  position: "absolute", right: -2, bottom: -2, width: 34, height: 34, borderRadius: "50%",
                  border: "1px solid rgba(201,168,106,0.5)", background: "#1A1D27", color: GOLD,
                  cursor: avatarBusy ? "default" : "pointer", fontSize: 15, lineHeight: 1, padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 3px 10px rgba(0,0,0,0.5)",
                }}>
                {avatarBusy ? "…" : "✎"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={avatarBusy}
              style={{ marginTop: 12, background: "none", border: "none", color: GOLD, fontSize: 11.5, letterSpacing: "0.12em", cursor: avatarBusy ? "default" : "pointer", fontFamily: "inherit" }}>
              {avatarBusy ? "アップロード中…" : avatar ? "顔写真を変更" : "顔写真を追加"}
            </button>
          </div>

          {/* 表示名 */}
          <label style={labelStyle}>表示名 *</label>
          <input value={form.display_name} onChange={(e) => set("display_name", e.target.value)}
            maxLength={30} placeholder="例: シュン / 塚真" style={inputStyle} />

          {/* 自己紹介 */}
          <label style={labelStyle}>自己紹介</label>
          <textarea value={form.bio} onChange={(e) => set("bio", e.target.value)}
            maxLength={300} rows={4} placeholder="旅と写真について、ひとこと。"
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.8 }} />
          <div style={{ fontSize: 10.5, color: "var(--dark-faint)", marginTop: 4, textAlign: "right" }}>{form.bio.length}/300</div>

          {/* 拠点 */}
          <label style={labelStyle}>拠点・活動エリア</label>
          <input value={form.area} onChange={(e) => set("area", e.target.value)}
            maxLength={40} placeholder="例: 東京 / 瀬戸内 を中心に" style={inputStyle} />

          {/* 機材 */}
          <label style={labelStyle}>使用機材</label>
          <input value={form.gear} onChange={(e) => set("gear", e.target.value)}
            maxLength={80} placeholder="例: SONY α7IV / 24-70mm" style={inputStyle} />

          {/* Instagram */}
          <label style={labelStyle}>Instagram</label>
          <input value={form.instagram} onChange={(e) => set("instagram", e.target.value)}
            maxLength={60} placeholder="例: @your_id または URL" style={inputStyle} />

          {/* サイト */}
          <label style={labelStyle}>サイト・その他リンク</label>
          <input value={form.website} onChange={(e) => set("website", e.target.value)}
            maxLength={120} placeholder="例: https://your-site.com" style={inputStyle} />

          {/* プラン管理(Stripe会員のみ・一番下) */}
          {hasStripe && (
            <div style={{ margin: "26px 0 4px", padding: "13px 15px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--hairline-dark)", borderRadius: 3 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.22em", color: GOLD, marginBottom: 8 }}>SUBSCRIPTION — プラン</div>
              <button onClick={openPortal} disabled={portalBusy}
                style={{ width: "100%", padding: "9px 0", border: "1px solid var(--hairline-dark)", background: "none", color: "var(--dark-body)", fontSize: 12.5, cursor: portalBusy ? "default" : "pointer", fontFamily: "inherit", letterSpacing: "0.1em", borderRadius: 2, opacity: portalBusy ? 0.6 : 1 }}>
                {portalBusy ? "読み込み中…" : "プラン・お支払いを管理"}
              </button>
              <div style={{ fontSize: 10.5, color: "var(--dark-faint)", marginTop: 7, lineHeight: 1.6 }}>
                カード変更・解約はこちら（Stripeのページへ移動します）
              </div>
            </div>
          )}

          {msg && (
            <div style={{
              marginTop: 16, padding: "9px 13px", fontSize: 12.5, borderRadius: 2,
              borderLeft: `2px solid ${msg.type === "ok" ? GOLD : "#C97B5E"}`,
              background: "rgba(255,255,255,0.03)",
              color: msg.type === "ok" ? GOLD_SOFT : "#E0A78E",
            }}>
              {msg.text}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
            <button onClick={onClose}
              style={{ background: "none", border: "1px solid var(--hairline-dark)", padding: "10px 20px",
                fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", color: "var(--dark-body)", letterSpacing: "0.1em", borderRadius: 2 }}>
              閉じる
            </button>
            <button onClick={save} disabled={busy || !dirty}
              style={{
                background: busy || !dirty ? "rgba(201,168,106,0.35)" : `linear-gradient(180deg, ${GOLD_SOFT}, ${GOLD})`,
                color: "#1A1408", border: "none", padding: "10px 26px", fontSize: 12.5, fontWeight: 700,
                cursor: busy || !dirty ? "default" : "pointer", fontFamily: "inherit", letterSpacing: "0.1em", borderRadius: 2,
              }}>
              {busy ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </div>

      {cropFile && (
        <AvatarCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={handleCropped} />
      )}
    </>
  );
}
