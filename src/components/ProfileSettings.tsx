"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

export default function ProfileSettings({ onClose }: Props) {
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [original, setOriginal] = useState<ProfileForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [hasStripe, setHasStripe] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, bio, area, instagram, website, gear, stripe_customer_id")
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
      setHasStripe(!!data?.stripe_customer_id);
    })();
  }, []);

  const set = (k: keyof ProfileForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = (Object.keys(form) as (keyof ProfileForm)[]).some((k) => form[k].trim() !== original[k].trim());

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
    display: "block", fontSize: 11, letterSpacing: "0.14em", color: "var(--ink-faint)", margin: "16px 0 8px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    border: "1px solid var(--hairline)", background: "var(--paper-raise)",
    padding: "10px 12px", fontSize: 14, fontFamily: "inherit", color: "var(--ink)",
    outline: "none",
  };

  return (
    <>
      {/* 背景 */}
      <div onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(7,8,12,0.6)" }} />

      {/* モーダル */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        zIndex: 91, background: "var(--paper)", padding: "32px 28px", width: "min(440px, 92vw)",
        maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <button onClick={onClose} aria-label="閉じる"
          style={{ position: "absolute", top: 14, right: 18, background: "none", border: "none",
            color: "var(--ink-faint)", fontSize: 20, cursor: "pointer", fontFamily: "inherit" }}>
          ×
        </button>

        <div className="caption" style={{ marginBottom: 4 }}>ACCOUNT</div>
        <h2 className="tz-serif" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", letterSpacing: "0.08em" }}>
          プロフィール設定
        </h2>

        {/* プラン管理(Stripe会員のみ表示) */}
        {hasStripe && (
          <div style={{ margin: "18px 0 6px", padding: "14px 16px", background: "var(--paper-raise)", border: "1px solid var(--hairline)" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--ink-faint)", marginBottom: 8 }}>SUBSCRIPTION</div>
            <button onClick={openPortal} disabled={portalBusy}
              style={{ width: "100%", padding: "9px 0", border: "1px solid rgba(237,232,220,0.2)", background: "none", color: "var(--ink-soft)", fontSize: 13, cursor: portalBusy ? "default" : "pointer", fontFamily: "inherit", letterSpacing: "0.1em", opacity: portalBusy ? 0.6 : 1 }}>
              {portalBusy ? "読み込み中…" : "プラン・お支払いを管理"}
            </button>
            <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 6 }}>
              カード変更・解約はこちら（Stripeのページへ移動します）
            </div>
          </div>
        )}

        {/* 表示名 */}
        <label style={labelStyle}>表示名 <span style={{ color: "var(--shu)" }}>*</span></label>
        <input value={form.display_name} onChange={(e) => set("display_name", e.target.value)}
          maxLength={30} placeholder="例: シュン / 塚真" style={inputStyle} />
        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 6 }}>
          みんなの図鑑でこの名前が表示されます（最大30文字）
        </div>

        {/* 自己紹介 */}
        <label style={labelStyle}>自己紹介</label>
        <textarea value={form.bio} onChange={(e) => set("bio", e.target.value)}
          maxLength={300} rows={4} placeholder="旅と写真について、ひとこと。"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }} />
        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4, textAlign: "right" }}>
          {form.bio.length}/300
        </div>

        {/* 拠点・活動エリア */}
        <label style={labelStyle}>拠点・活動エリア</label>
        <input value={form.area} onChange={(e) => set("area", e.target.value)}
          maxLength={40} placeholder="例: 東京 / 瀬戸内 を中心に" style={inputStyle} />

        {/* 使用機材 */}
        <label style={labelStyle}>使用機材</label>
        <input value={form.gear} onChange={(e) => set("gear", e.target.value)}
          maxLength={80} placeholder="例: SONY α7IV / 24-70mm" style={inputStyle} />

        {/* Instagram */}
        <label style={labelStyle}>Instagram</label>
        <input value={form.instagram} onChange={(e) => set("instagram", e.target.value)}
          maxLength={60} placeholder="例: @your_id または URL" style={inputStyle} />

        {/* サイト・その他リンク */}
        <label style={labelStyle}>サイト・その他リンク</label>
        <input value={form.website} onChange={(e) => set("website", e.target.value)}
          maxLength={120} placeholder="例: https://your-site.com" style={inputStyle} />

        {msg && (
          <div style={{
            marginTop: 16, padding: "8px 12px", fontSize: 12.5,
            borderLeft: `2px solid ${msg.type === "ok" ? "var(--ink-soft)" : "var(--shu)"}`,
            color: msg.type === "ok" ? "var(--ink-soft)" : "var(--shu)",
          }}>
            {msg.text}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ background: "none", border: "1px solid var(--hairline)", padding: "9px 20px",
              fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", color: "var(--ink-soft)", letterSpacing: "0.1em" }}>
            キャンセル
          </button>
          <button onClick={save} disabled={busy || !dirty}
            style={{
              background: "var(--ink)", color: "var(--paper)", border: "none",
              padding: "9px 24px", fontSize: 12.5, cursor: busy || !dirty ? "default" : "pointer", fontFamily: "inherit",
              letterSpacing: "0.1em", opacity: busy || !dirty ? 0.5 : 1,
            }}>
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </>
  );
}
