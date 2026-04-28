import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Healthcheck — permet de tester depuis un navigateur que la route existe.
// GET https://yieldapp.fr/api/stripe/webhook → 200 si la route est déployée.
// (Ne touche à rien, juste un OK pour valider le routing.)
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/stripe/webhook",
    method: "POST expected",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  console.log("[stripe/webhook] RECU : Webhook Stripe", {
    method: req.method,
    url: req.url,
    sigPresent: Boolean(req.headers.get("stripe-signature")),
    contentType: req.headers.get("content-type"),
    timestamp: new Date().toISOString(),
  });

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe/webhook] ❌ Variables d'env manquantes : STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET");
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

  // ─── Idempotency : ack immédiat si l'event a déjà été traité ───
  // Stripe peut retenter un event en cas de timeout / 5xx. Sans cette garde,
  // on risque double-activation, double-désactivation, états incohérents.
  const { error: idempError } = await supabase
    .from("processed_events")
    .insert({ id: event.id });

  if (idempError) {
    const code = (idempError as { code?: string }).code;
    // 23505 = unique_violation → l'event a déjà été inséré (déjà traité)
    if (code === "23505") {
      console.log("[stripe/webhook] event déjà traité (idempotency hit)", event.id);
      return NextResponse.json({ received: true, idempotent: true });
    }
    // 42P01 = relation does not exist → la migration n'a pas été appliquée.
    // On dégrade gracefully (pas d'idempotency mais on traite quand même)
    // pour ne pas bloquer le tunnel commercial.
    if (code === "42P01") {
      console.warn("[stripe/webhook] table processed_events absente — idempotency désactivée. APPLIQUER LA MIGRATION 002.");
    } else {
      console.error("[stripe/webhook] idempotency check failed:", idempError.message, "code:", code);
      return NextResponse.json({ error: idempError.message }, { status: 500 });
    }
  }

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
        const customerEmail = session.customer_email
          ?? session.customer_details?.email
          ?? null;

        if (!userId) {
          console.warn("[stripe/webhook] checkout.session.completed without client_reference_id", session.id);
          return NextResponse.json({ received: true });
        }

        // ⭐ UPSERT plutôt que UPDATE : si le trigger handle_new_user n'a pas
        // créé la ligne profiles (cas connu si la migration 001 manque), on
        // la crée ici. UPDATE sur 0 ligne échoue silencieusement et l'UI
        // reste en 'Essai 14j' alors que le paiement est validé.
        const { data: upserted, error: upsertError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: userId,
              email: customerEmail,
              is_subscribed: true,
              stripe_customer_id: customerId,
            },
            { onConflict: "id" }
          )
          .select("id, is_subscribed, stripe_customer_id");

        if (upsertError) {
          console.error("[stripe/webhook] upsert profiles failed:", upsertError.message, "code:", (upsertError as { code?: string }).code);
          throw upsertError;
        }

        if (!upserted || upserted.length === 0) {
          console.error("[stripe/webhook] ⚠️ upsert n'a renvoyé aucune ligne. userId:", userId);
        } else {
          console.log("[stripe/webhook] ✅ subscription activated:", {
            user_id: userId,
            customer_id: customerId,
            updated_rows: upserted.length,
          });
        }
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
