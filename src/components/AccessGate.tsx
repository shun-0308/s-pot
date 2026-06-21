"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AccessStatus = "loading" | "login" | "invite" | "blocked" | "ok";

// ログイン状態 + 公開モード(beta/members) + 会員判定 から、表示すべき画面を決める。
export function useAccess(session: Session | null, authReady: boolean) {
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [nonce, setNonce] = useState(0);
  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!authReady) return;
    let alive = true;
    (async () => {
      if (!session) { if (alive) setStatus("login"); return; }
      setStatus("loading");

      // 公開モード
      const mode = (await supabase.rpc("get_access_mode")).data ?? "beta";

      // S-Lab会員か(サーバー経由)。会員なら常に許可。
      let member = false;
      try {
        const token = session.access_token;
        const r = await fetch("/api/membership", { headers: { Authorization: `Bearer ${token}` } });
        member = (await r.json())?.member === true;
      } catch {}
      if (!alive) return;
      if (member) { setStatus("ok"); return; }

      // Stripe課金会員かどうかをprofilesで確認
      const { data: profile } = await supabase
        .from("profiles")
        .select("membership_status")
        .eq("id", session.user.id)
        .single();
      if (!alive) return;
      if (profile?.membership_status === "active") { setStatus("ok"); return; }

      if (mode === "members") {
        // クーポン利用者は無料アクセス許可
        const couponOk = (await supabase.rpc("has_coupon_access")).data === true;
        if (!alive) return;
        setStatus(couponOk ? "ok" : "blocked");
        return;
      }

      // ベータ中: 招待コードで解錠済みなら許可、未解錠なら入力画面
      const unlocked = (await supabase.rpc("has_beta_access")).data === true;
      if (!alive) return;
      setStatus(unlocked ? "ok" : "invite");
    })();
    return () => { alive = false; };
  }, [session, authReady, nonce]);

  return { status, recheck };
}

const screenWrap: React.CSSProperties = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
};
const card: React.CSSProperties = {
  width: "100%", maxWidth: 380, textAlign: "center",
};

export function Splash() {
  return (
    <div style={screenWrap}>
      <div className="caption" style={{ color: "var(--ink-faint)", letterSpacing: "0.3em" }}>LOADING…</div>
    </div>
  );
}

// ベータ: 招待コード入力
export function InviteScreen({ onUnlocked, onLogout }: { onUnlocked: () => void; onLogout: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true); setErr(null);
    const ok = (await supabase.rpc("redeem_invite", { p_code: code.trim() })).data === true;
    setBusy(false);
    if (ok) onUnlocked();
    else setErr("合言葉が違うようです。もう一度ご確認ください。");
  };

  return (
    <div style={screenWrap}>
      <div className="card" style={card}>
        <div className="caption">S-pot — モニター版</div>
        <h1 className="tz-serif" style={{ fontSize: 30, fontWeight: 700, margin: "8px 0 6px", letterSpacing: "0.14em" }}>
          ようこそ
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 22 }}>
          いまは招待制のお試し期間です。<br />お渡しした合言葉を入力してください。
        </p>
        <input value={code} onChange={(e) => setCode(e.target.value)} autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="合言葉"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid var(--hairline)", background: "var(--paper-raise)", color: "var(--ink)", fontFamily: "inherit", fontSize: 15, textAlign: "center", letterSpacing: "0.1em", marginBottom: 10 }} />
        <button onClick={submit} disabled={busy || !code.trim()}
          style={{ width: "100%", padding: 14, border: "none", background: "var(--shu)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.2em", opacity: busy || !code.trim() ? 0.5 : 1 }}>
          {busy ? "確認中…" : "はじめる"}
        </button>
        {err && <p style={{ fontSize: 12.5, color: "var(--shu)", marginTop: 14, lineHeight: 1.8 }}>{err}</p>}
        <button onClick={onLogout}
          style={{ display: "block", margin: "20px auto 0", background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 4 }}>
          別のアカウントでログイン
        </button>
      </div>
    </div>
  );
}

// 本公開: 非会員向け
export function MembersOnlyScreen({ onLogout, onUnlocked }: { onLogout: () => void; onUnlocked: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showCoupon, setShowCoupon] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("redeem_coupon", { p_code: code.trim() });
    setBusy(false);
    if (error || data !== true) {
      setErr("コードが無効か、使用枚数の上限に達しています。");
    } else {
      onUnlocked();
    }
  };

  const startSubscription = async () => {
    setSubscribing(true); setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErr("ログインが必要です。"); return; }
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      });
      const { url, error: apiErr } = await res.json();
      if (apiErr || !url) { setErr("決済ページの準備に失敗しました。しばらくお待ちください。"); return; }
      window.location.href = url;
    } catch {
      setErr("エラーが発生しました。もう一度お試しください。");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div style={screenWrap}>
      <div className="card" style={card}>
        <div className="caption">S-pot</div>
        <h1 className="tz-serif" style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 6px", letterSpacing: "0.12em" }}>
          会員登録が必要です
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 2, marginBottom: 22 }}>
          S-potはS-Labの会員専用アプリです。<br />
          月額プランにご登録いただくと、すべての機能をお使いいただけます。
        </p>

        {/* Stripe月額登録ボタン */}
        <button onClick={startSubscription} disabled={subscribing}
          style={{ width: "100%", padding: 14, border: "none", background: "var(--shu)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: subscribing ? "default" : "pointer", fontFamily: "inherit", letterSpacing: "0.16em", opacity: subscribing ? 0.6 : 1, marginBottom: 10 }}>
          {subscribing ? "準備中…" : "月額プランに登録する  ¥980 / 月"}
        </button>

        {err && <p style={{ fontSize: 12.5, color: "var(--shu)", marginBottom: 12, lineHeight: 1.8 }}>{err}</p>}

        <button onClick={onLogout}
          style={{ width: "100%", padding: 13, border: "1px solid rgba(237,232,220,0.2)", background: "transparent", color: "var(--ink-soft)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em" }}>
          別のメールでログインし直す
        </button>

        {/* クーポンコード */}
        {!showCoupon ? (
          <button onClick={() => setShowCoupon(true)}
            style={{ display: "block", margin: "18px auto 0", background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 4, letterSpacing: "0.06em" }}>
            クーポンコードをお持ちの方
          </button>
        ) : (
          <div style={{ marginTop: 20, borderTop: "1px solid var(--hairline)", paddingTop: 20 }}>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10, letterSpacing: "0.06em" }}>
              クーポンコードを入力
            </p>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="コードを入力"
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", border: "1px solid var(--hairline)", background: "var(--paper-raise)", color: "var(--ink)", fontFamily: "inherit", fontSize: 15, textAlign: "center", letterSpacing: "0.14em", marginBottom: 8 }} />
            <button onClick={submit} disabled={busy || !code.trim()}
              style={{ width: "100%", padding: 13, border: "none", background: "var(--shu)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.2em", opacity: busy || !code.trim() ? 0.5 : 1 }}>
              {busy ? "確認中…" : "適用する"}
            </button>
            {err && <p style={{ fontSize: 12.5, color: "var(--shu)", marginTop: 12, lineHeight: 1.8 }}>{err}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
