import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-05-27.dahlia" });

// Stripeからのwebhookを受信してSupabaseを更新する
// POST /api/stripe/webhook
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  switch (event.type) {
    // サブスクリプション開始・更新
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      if (!userId) break;

      const isActive = sub.status === "active" || sub.status === "trialing";
      const isGrace = sub.status === "past_due";

      await sb.from("profiles").update({
        membership_status: isActive ? "active" : isGrace ? "grace" : "expired",
        stripe_subscription_id: sub.id,
      }).eq("id", userId);
      break;
    }

    // サブスクリプション解約
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      if (!userId) break;

      await sb.from("profiles").update({
        membership_status: "expired",
        stripe_subscription_id: null,
      }).eq("id", userId);
      break;
    }

    // 請求成功
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      // stripe_customer_idからユーザーを特定
      await sb.from("profiles").update({ membership_status: "active" })
        .eq("stripe_customer_id", customerId);
      break;
    }

    // 請求失敗
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      await sb.from("profiles").update({ membership_status: "grace" })
        .eq("stripe_customer_id", customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
