import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Note : ce webhook NE passe PAS par apiErrorResponse parce que Stripe attend
// un format de réponse spécifique :
//   - 200 = ack (Stripe ne retentera pas)
//   - 4xx = erreur définitive (Stripe ne retentera pas)
//   - 5xx = erreur transitoire (Stripe retentera selon backoff)
// On garde donc les NextResponse.json directs, et tous les logs passent par
// le logger commun (scrub PII automatique pour les emails / JWTs / UUIDs).

/**
 * Healthcheck — permet de tester depuis un navigateur que la route existe.
 * GET https://www.yieldapp.fr/api/stripe/webhook → 200 si la route est déployée.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/stripe/webhook",
    method: "POST expected",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Webhook Stripe : maintient `profiles.is_subscribed` à jour.
 * Idempotent via `processed_events` (insert avec contrainte unique). En cas
 * de unique_violation (event déjà reçu), on ack 200 sans rien faire.
 */
export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    logger.error("stripe/webhook", "env missing", { keys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] });
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    logger.error("stripe/webhook", "env missing", { keys: ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"] });
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
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    logger.error("stripe/webhook", "signature verification failed", { message });
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // ─── Idempotency : ack immédiat si l'event a déjà été traité ───
  // Stripe peut retenter un event en cas de timeout / 5xx. Sans cette garde,
  // on risque double-activation, double-désactivation, états incohérents.
  const { error: idempError } = await supabaseAdmin
    .from("processed_events")
    .insert({ id: event.id });

  if (idempError) {
    const code = (idempError as { code?: string }).code;
    // 23505 = unique_violation → l'event a déjà été inséré (déjà traité)
    if (code === "23505") {
      return NextResponse.json({ received: true, idempotent: true });
    }
    // 42P01 = relation does not exist → migration 002 manquante. Dégradation
    // gracieuse (pas d'idempotency mais on traite quand même) pour ne pas
    // bloquer le tunnel commercial.
    if (code === "42P01") {
      logger.warn("stripe/webhook", "table processed_events absente — APPLIQUER LA MIGRATION 002");
    } else {
      logger.error("stripe/webhook", "idempotency check failed", { message: idempError.message, code });
      return NextResponse.json({ error: idempError.message }, { status: 500 });
    }
  }

  const setSubscriptionByCustomer = async (customerId: string, isSubscribed: boolean) => {
    const { error } = await supabaseAdmin
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
          logger.warn("stripe/webhook", "checkout.session.completed without client_reference_id", { sessionId: session.id });
          return NextResponse.json({ received: true });
        }

        // ⭐ UPSERT plutôt que UPDATE : si le trigger handle_new_user n'a pas
        // créé la ligne profiles (cas connu si la migration 001 manque), on
        // la crée ici. UPDATE sur 0 ligne échoue silencieusement et l'UI
        // reste en 'Essai 14j' alors que le paiement est validé.
        const { data: upserted, error: upsertError } = await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              id: userId,
              email: customerEmail,
              is_subscribed: true,
              stripe_customer_id: customerId,
            },
            { onConflict: "id" },
          )
          .select("id, is_subscribed, stripe_customer_id");

        if (upsertError) {
          logger.error("stripe/webhook", "upsert profiles failed", { message: upsertError.message });
          throw upsertError;
        }
        if (!upserted || upserted.length === 0) {
          logger.error("stripe/webhook", "upsert returned 0 rows", { userId });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        // Actif = trialing OU active ; tout le reste (past_due, canceled, incomplete, etc.) coupe l'accès
        const isActive = sub.status === "trialing" || sub.status === "active";
        await setSubscriptionByCustomer(customerId, isActive);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await setSubscriptionByCustomer(customerId, false);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        // Filet de sécurité : si checkout.session.completed est arrivé en retard
        // (ou n'a pas trouvé le user_id), on ré-active l'abonnement à chaque
        // facture payée. Cas typiques : trial_end → conversion automatique,
        // facture mensuelle, ou checkout.session.completed perdu.
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id ?? null;
        // Stripe SDK >= 17 : `subscription` n'est plus directement sur Invoice
        // (déplacé sous parent.subscription_details). On accède via cast pour
        // rester compatible avec les anciennes API responses.
        const invoiceAny = invoice as unknown as {
          subscription?: string | { id: string } | null;
          parent?: { subscription_details?: { subscription?: string | null } | null } | null;
        };
        const rawSub = invoiceAny.subscription
          ?? invoiceAny.parent?.subscription_details?.subscription
          ?? null;
        const subscriptionId = typeof rawSub === "string" ? rawSub : rawSub?.id ?? null;

        if (!customerId) {
          logger.warn("stripe/webhook", "invoice.paid sans customer", { invoiceId: invoice.id });
          break;
        }

        // Stratégie 1 — UPDATE par stripe_customer_id (cas normal)
        const { data: updated, error: updateErr } = await supabaseAdmin
          .from("profiles")
          .update({ is_subscribed: true })
          .eq("stripe_customer_id", customerId)
          .select("id");

        if (updateErr) {
          logger.error("stripe/webhook", "invoice.paid update err", { message: updateErr.message });
          throw updateErr;
        }

        if (updated && updated.length > 0) break;

        // Stratégie 2 — Profil pas trouvé par customer_id : on récupère la subscription
        // pour lire metadata.supabase_user_id (qu'on stocke à la création du checkout)
        if (subscriptionId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const userIdFromMeta = subscription.metadata?.supabase_user_id;
            if (userIdFromMeta) {
              const { error: upsertErr } = await supabaseAdmin
                .from("profiles")
                .upsert(
                  {
                    id: userIdFromMeta,
                    is_subscribed: true,
                    stripe_customer_id: customerId,
                  },
                  { onConflict: "id" },
                );
              if (upsertErr) {
                logger.error("stripe/webhook", "invoice.paid upsert via metadata err", { message: upsertErr.message });
                throw upsertErr;
              }
              break;
            }
          } catch (subErr) {
            logger.error("stripe/webhook", "retrieve subscription failed", { error: subErr });
          }
        }

        logger.warn("stripe/webhook", "invoice.paid: no profile found for customer", { customerId });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id ?? null;
        // On ne coupe PAS immédiatement : Stripe retente le paiement 3-4 fois sur 2-3 semaines.
        // L'accès sera coupé si Stripe passe l'abo en "past_due" puis "canceled" via subscription.updated.
        logger.warn("stripe/webhook", "invoice.payment_failed", { customerId, invoiceId: invoice.id });
        break;
      }

      default:
        // Les autres events sont ignorés mais on ACK quand même pour que Stripe ne retente pas.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    logger.error("stripe/webhook", "handler threw", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
