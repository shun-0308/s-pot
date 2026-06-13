"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session)
          setMsg("確認メールを送りました。メール内のリンクを開いてから、ログインしてください。");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  const input = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px 13px",
    borderRadius: 0,
    border: "1px solid var(--hairline)",
    fontFamily: "inherit",
    fontSize: 15,
    marginBottom: 10,
    background: "var(--paper-raise)",
    color: "var(--ink)",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card" style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div className="caption">MY TRAVEL ATLAS</div>
          <h1 className="tz-serif" style={{ fontSize: 38, fontWeight: 700, margin: "8px 0 0", letterSpacing: "0.14em" }}>
            S-pot
          </h1>
          <div style={{ width: 28, height: 1, background: "var(--shu)", margin: "16px auto 14px" }} />
          <div style={{ fontSize: 12, color: "var(--ink-soft)", letterSpacing: "0.1em" }}>
            写真からつくる、自分だけの観光図鑑
          </div>
        </div>

        <input style={input} type="email" placeholder="メールアドレス" value={email}
          onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input style={input} type="password" placeholder="パスワード(6文字以上)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          onKeyDown={(e) => e.key === "Enter" && submit()} />

        <button onClick={submit} disabled={busy}
          style={{ width: "100%", padding: 14, border: "none", background: "var(--shu)",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "0.2em", opacity: busy ? 0.6 : 1, marginTop: 6 }}>
          {busy ? "処理中…" : mode === "login" ? "ログイン" : "アカウント作成"}
        </button>

        {msg && (
          <p style={{ fontSize: 12.5, color: "var(--shu)", marginTop: 14, lineHeight: 1.9 }}>{msg}</p>
        )}

        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(null); }}
          style={{ display: "block", margin: "20px auto 0", background: "none", border: "none",
            color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            textDecoration: "underline", textUnderlineOffset: 4, letterSpacing: "0.06em" }}>
          {mode === "login" ? "はじめての方: アカウント作成" : "アカウントをお持ちの方: ログイン"}
        </button>
      </div>
    </div>
  );
}
