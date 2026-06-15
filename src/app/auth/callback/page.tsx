"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// メール確認リンクから戻ってきたとき、セッションを確立してトップへ飛ばす
export default function AuthCallback() {
  const [msg, setMsg] = useState("認証中…");

  useEffect(() => {
    const hash = window.location.hash;

    // ハッシュにアクセストークンがあればSupabaseが自動処理する
    // onAuthStateChange で SIGNED_IN を待ってリダイレクト
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        window.location.replace("/");
      }
    });

    // ハッシュがない・エラー時はログイン画面へ
    const timer = setTimeout(() => {
      if (!hash.includes("access_token")) {
        setMsg("リンクが無効か期限切れです。もう一度メールを確認してください。");
        setTimeout(() => window.location.replace("/"), 3000);
      }
    }, 5000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div className="caption" style={{ letterSpacing: "0.3em", color: "var(--ink-faint)" }}>S-pot</div>
      <div style={{ fontSize: 13, color: "var(--ink-soft)", letterSpacing: "0.1em" }}>{msg}</div>
    </div>
  );
}
