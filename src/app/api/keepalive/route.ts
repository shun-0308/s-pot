import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Supabase の無料枠は「一定期間アクセスが無い」と自動で一時停止(INACTIVE)する。
// このルートを Vercel Cron が毎日叩き、DBへ軽いクエリを1回投げて“起こし続ける”。
// ※ 既に停止したプロジェクトはクエリでは復活しない(要 restore)。あくまで停止を防ぐ用途。

export const dynamic = "force-dynamic"; // キャッシュさせない
export const runtime = "nodejs";

export async function GET(req: Request) {
  // CRON_SECRET を設定していれば、Vercel Cron からの呼び出しだけ通す(任意)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("unauthorized", { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // サーバー専用。service role なら RLS 無関係に確実にDBへ到達する。無ければ anon で代用。
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ alive: false, error: "missing supabase env" }, { status: 500 });
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const t0 = Date.now();
  try {
    // 行データは要らない。head:true でカウントだけ取り、DBに触れれば目的達成。
    const { count, error } = await sb.from("app_config").select("*", { count: "exact", head: true });
    return NextResponse.json({
      alive: !error,
      count: count ?? null,
      ms: Date.now() - t0,
      error: error?.message ?? null,
      at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { alive: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e), at: new Date().toISOString() },
      { status: 503 }
    );
  }
}
