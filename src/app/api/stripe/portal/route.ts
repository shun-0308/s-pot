import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-05-27.dahlia" });

// Stripe Customer Portal セッション作成
// POST /api/stripe/portal
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const SP_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SP_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const sb = createClient(SP_URL, SP_SERVICE, { auth: { persistSession: false } });
  const anonSb = createClient(SP_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data: { user }, error: authErr } = await anonSb.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await sb
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) return NextResponse.json({ error: "no_subscription" }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://s-pot.vercel.app";

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/`,
  });

  return NextResponse.json({ url: session.url });
}
