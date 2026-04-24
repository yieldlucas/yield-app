import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe/webhook] signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const setSubscriptionByCustomer = async (customerId: string, isSubscribed: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_subscribed: isSubscribed })
      .eq("stripe_customer_id", customerId);
    if (error) throw error;
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const customerId = typeof session.customer === "string" ? session.customer : null;

        if (!userId) {
          console.warn("[stripe/webhook] checkout.session.completed without client_reference_id", session.id);
          return NextResponse.json({ received: true });
        }

        const { error } = await supabase
          .from("profiles")
          .update({
            is_subscribed: true,
            stripe_customer_id: customerId,
          })
          .eq("id", userId);

        if (error) throw error;
        console.log(`[stripe/webhook] subscription activated: user=${userId} customer=${customerId}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        // Actif = trialing OU active ; tout le reste (past_due, canceled, incomplete, etc.) coupe l'accès
        const isActive = sub.status === "trialing" || sub.status === "active";
        await setSubscriptionByCustomer(customerId, isActive);
        console.log(`[stripe/webhook] subscription.updated: customer=${customerId} status=${sub.status} → is_subscribed=${isActive}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await setSubscriptionByCustomer(customerId, false);
        console.log(`[stripe/webhook] subscription.deleted: customer=${customerId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id ?? null;
        // On ne coupe PAS immédiatement : Stripe retente le paiement 3-4 fois sur 2-3 semaines.
        // L'accès sera coupé si Stripe passe l'abo en "past_due" puis "canceled" via subscription.updated.
        console.warn(`[stripe/webhook] invoice.payment_failed: customer=${customerId} invoice=${invoice.id}`);
        break;
      }

      default:
        // Les autres events sont ignorés mais on ACK quand même pour que Stripe ne retente pas
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("[stripe/webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
