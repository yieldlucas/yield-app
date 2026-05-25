import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { authorizeBearer } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-admin";
import { apiErrorResponse, internal } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Suppression de compte (RGPD). L'identité est vérifiée via le Bearer JWT
 * (clé anon), et la suppression elle-même utilise le service-role
 * (auth.admin.deleteUser). La cascade DB (ON DELETE CASCADE) supprime ensuite
 * profiles, restaurants, invoices, etc. Le storage est nettoyé séparément
 * par un trigger ou un cron — voir migration 002.
 *
 * IMPORTANT : on annule d'abord l'abonnement Stripe. Sans ça, un client abonné
 * qui supprime son compte continue d'être facturé (la subscription Stripe vit
 * indépendamment de la base) — réclamation + remboursement à la clé.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw internal("Service role non configuré");
    }
    const { userId } = await authorizeBearer(req);

    const adminClient = getServiceClient();

    // ─── 1. Annulation Stripe (best-effort) ───
    // On lit le stripe_customer_id AVANT de supprimer l'user, et on cancel
    // toute subscription active. Best-effort : un échec Stripe ne doit pas
    // empêcher la suppression RGPD du compte (droit à l'effacement), mais on
    // le log pour que Lucas puisse annuler manuellement si besoin.
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("stripe_customer_id")
          .eq("id", userId)
          .maybeSingle();
        const customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
        if (customerId) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
          for (const sub of subs.data) {
            if (sub.status !== "canceled" && sub.status !== "incomplete_expired") {
              await stripe.subscriptions.cancel(sub.id);
            }
          }
        }
      } catch (stripeErr) {
        logger.error("account/delete", "Stripe cancel failed (compte supprimé quand même)", {
          userId,
          error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
        });
      }
    }

    // ─── 2. Suppression du compte auth (cascade DB) ───
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw internal("Suppression du compte impossible", deleteError);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "account/delete");
  }
}
