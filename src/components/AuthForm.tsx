"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false); // 登録完了→メール確認待ち

  const submit = async () => {
    if (!email || !password) return;
    if (mode === "signup" && !displayName.trim()) {
      setMsg({ type: "err", text: "表示名を入力してください" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        // メール確認後にdisplay_nameをセット(upsert)
        // ユーザーが確認メールをクリックしてログインしたタイミングでも
        // プロフィール設定から変更できるので、ここではmetaに仮保存する
        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            display_name: displayName.trim(),
          });
        }

        if (!data.session) {
          setDone(true);
        }
      }
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "エラーが発生しました" });
    } finally {
      setBusy(false);
    }
  };

  const input: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 13px",
    borderRadius: 0,
    border: "1px solid var(--hairline)",
    fontFamily: "inherit",
    fontSize: 15,
    marginBottom: 10,
    background: "var(--paper-raise)",
    color: "var(--ink)",
    outline: "none",
  };

  // 登録完了→メール確認待ち画面
  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="card" style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>📬</div>
          <div className="caption" style={{ marginBottom: 8 }}>ALMOST THERE</div>
          <h2 className="tz-serif" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px", letterSpacing: "0.08em" }}>
            確認メールを送りました
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 2, marginBottom: 24 }}>
            <strong style={{ color: "var(--ink)" }}>{email}</strong> に届いたメールを開いて、
            「メールアドレスを確認する」ボタンを押してください。<br />
            その後、自動でアプリが開きます。
          </p>
          <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 18 }}>
            <p style={{ fontSize: 11.5, color: "var(--ink-faint)", lineHeight: 1.9 }}>
              メールが届かない場合は迷惑メールフォルダをご確認ください。
            </p>
            <button onClick={() => { setDone(false); setMode("login"); }}
              style={{ marginTop: 12, background: "none", border: "none", color: "var(--ink-faint)",
                fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
                textUnderlineOffset: 4 }}>
              ログイン画面に戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        {mode === "signup" && (
          <input style={input} type="text" placeholder="表示名（みんなの図鑑に表示されます）"
            value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
        )}

        <input style={input} type="email" placeholder="メールアドレス" value={email}
          onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input style={input} type="password" placeholder="パスワード（6文字以上）" value={password}
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
          <p style={{ fontSize: 12.5, color: msg.type === "err" ? "var(--shu)" : "var(--ink-soft)",
            marginTop: 14, lineHeight: 1.9 }}>{msg.text}</p>
        )}

        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(null); setDisplayName(""); }}
          style={{ display: "block", margin: "20px auto 0", background: "none", border: "none",
            color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            textDecoration: "underline", textUnderlineOffset: 4, letterSpacing: "0.06em" }}>
          {mode === "login" ? "はじめての方: アカウント作成" : "アカウントをお持ちの方: ログイン"}
        </button>
      </div>
    </div>
  );
}
