"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  onClose: () => void;
};

export default function ProfileSettings({ onClose }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [original, setOriginal] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      const name = data?.display_name ?? "";
      setDisplayName(name);
      setOriginal(name);
    })();
  }, []);

  const save = async () => {
    const name = displayName.trim();
    if (!name) { setMsg({ type: "err", text: "名前を入力してください" }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未ログイン");
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name })
        .eq("id", user.id);
      if (error) throw error;
      setOriginal(name);
      setMsg({ type: "ok", text: "保存しました" });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "保存に失敗しました" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* 背景 */}
      <div onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(7,8,12,0.6)" }} />

      {/* モーダル */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        zIndex: 91, background: "var(--paper)", padding: "32px 28px", width: "min(420px, 92vw)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <button onClick={onClose} aria-label="閉じる"
          style={{ position: "absolute", top: 14, right: 18, background: "none", border: "none",
            color: "var(--ink-faint)", fontSize: 20, cursor: "pointer", fontFamily: "inherit" }}>
          ×
        </button>

        <div className="caption" style={{ marginBottom: 4 }}>ACCOUNT</div>
        <h2 className="tz-serif" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 24px", letterSpacing: "0.08em" }}>
          プロフィール設定
        </h2>

        <label style={{ display: "block", fontSize: 11, letterSpacing: "0.14em", color: "var(--ink-faint)", marginBottom: 8 }}>
          表示名
        </label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={30}
          placeholder="例: シュン / 塚真"
          style={{
            width: "100%", boxSizing: "border-box",
            border: "1px solid var(--hairline)", background: "var(--paper-raise)",
            padding: "10px 12px", fontSize: 14, fontFamily: "inherit", color: "var(--ink)",
            outline: "none",
          }}
        />
        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 6 }}>
          みんなの図鑑でこの名前が表示されます（最大30文字）
        </div>

        {msg && (
          <div style={{
            marginTop: 14, padding: "8px 12px", fontSize: 12.5,
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
          <button onClick={save} disabled={busy || displayName.trim() === original}
            style={{
              background: "var(--ink)", color: "var(--paper)", border: "none",
              padding: "9px 24px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
              letterSpacing: "0.1em", opacity: busy || displayName.trim() === original ? 0.5 : 1,
            }}>
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </>
  );
}
