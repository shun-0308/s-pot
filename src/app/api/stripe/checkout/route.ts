import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-05-27.dahlia" });

// Stripe Checkoutセッション作成
// POST /api/stripe/checkout
// Body: { priceId?: string }  省略時は通常プラン(STRIPE_PRICE_ID)
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { priceId } = (await req.json().catch(() => ({}))) as { priceId?: string };
    const resolvedPriceId = priceId ?? process.env.STRIPE_PRICE_ID!;

    const SP_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SP_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!SP_URL || !SP_SERVICE) {
      console.error("Missing env:", { SP_URL: !!SP_URL, SP_SERVICE: !!SP_SERVICE });
      return NextResponse.json({ error: "server_config_error" }, { status: 500 });
    }

    // サービスロールクライアント（RLSをバイパス）
    const sb = createClient(SP_URL, SP_SERVICE, { auth: { persistSession: false } });

    // ログインユーザー確認
    const anonSb = createClient(SP_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user }, error: authErr } = await anonSb.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // 既存のStripe顧客IDを取得（なければ新規作成）
    const { data: profile, error: profileErr } = await sb
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileErr && profileErr.code !== "PGRST116") {
      console.error("Profile fetch error:", profileErr);
    }

    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      // profilesに行がなければupsert
      await sb.from("profiles").upsert({ id: user.id, stripe_customer_id: customerId });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://s-pot.vercel.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancel`,
      locale: "ja",
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Stripe checkout error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
