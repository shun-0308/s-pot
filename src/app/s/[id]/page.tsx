"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import SpotDetail from "@/components/SpotDetail";
import { fetchPublicRecord, type RecordWithPhotos } from "@/lib/records";
import { captionOf } from "@/lib/prefectures";
import { countryByCode, JAPAN_CODE } from "@/lib/world";

// 公開ページ: ログイン不要で、visibility=public の記録1件を読み取り専用で表示する。
// アクセスゲート(page.tsx)の外にある独立ルートなので、非会員・未ログインでも開ける。
// 非公開/存在しない記録は RLS により取得できず、「公開されていません」を表示する。
export default function PublicSpotPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [rec, setRec] = useState<RecordWithPhotos | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound" | "error">("loading");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchPublicRecord(id)
      .then((r) => { if (!alive) return; if (r) { setRec(r); setState("ok"); } else setState("notfound"); })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [id]);

  const brand = (
    <div style={{ position: "fixed", top: 12, left: 16, zIndex: 30 }}>
      <a href="/" style={{ textDecoration: "none", color: "var(--dark-strong)", fontFamily: "'Shippori Mincho B1', serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.16em" }}>
        S-pot
      </a>
    </div>
  );

  if (state === "loading")
    return <div style={{ background: "var(--dark)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--dark-faint)", fontSize: 13, letterSpacing: "0.2em" }}>{brand}読み込み中…</div>;

  if (state !== "ok" || !rec)
    return (
      <div style={{ background: "var(--dark)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        {brand}
        <div style={{ color: "var(--dark-strong)", fontFamily: "'Shippori Mincho B1', serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
          {state === "error" ? "読み込みに失敗しました" : "この記録は公開されていません"}
        </div>
        <div style={{ color: "var(--dark-faint)", fontSize: 13, lineHeight: 1.9, maxWidth: 360 }}>
          リンクが変更されたか、非公開に戻された可能性があります。
        </div>
        <a href="/" style={{ marginTop: 22, color: "var(--dark-body)", fontSize: 12.5, letterSpacing: "0.14em", border: "1px solid var(--hairline-dark)", padding: "9px 18px", textDecoration: "none" }}>
          S-pot をひらく →
        </a>
      </div>
    );

  const captionText = rec.country_code === JAPAN_CODE
    ? captionOf(rec.pref_code, rec.taken_at)
    : `${(countryByCode(rec.country_code)?.name ?? "").toUpperCase()}${rec.taken_at ? ` — ${rec.taken_at.replaceAll("-", ".")}` : ""}`;

  return (
    <div style={{ background: "var(--dark)", minHeight: "100vh" }}>
      {brand}
      <div style={{ height: 8 }} />
      <SpotDetail backLabel="" captionText={captionText} rec={rec} busy={false} isOwner={false} />
      <div style={{ textAlign: "center", padding: "8px 20px 48px" }}>
        <a href="/" style={{ color: "var(--dark-body)", fontSize: 12.5, letterSpacing: "0.12em", border: "1px solid var(--hairline-dark)", padding: "11px 22px", textDecoration: "none", display: "inline-block" }}>
          写真からつくる、自分だけの観光図鑑 — S-pot をひらく →
        </a>
      </div>
    </div>
  );
}
