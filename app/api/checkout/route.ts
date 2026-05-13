import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { authorizeBearer } from "@/lib/api-auth";
import { apiErrorResponse, badRequest, internal } from "@/lib/api-error";
import { getServiceClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const TRIAL_DAYS = 14;

/** Calcule les jours d'essai à passer à Stripe en tenant compte du parrainage.
 *
 *  - User non-parrainé (trial_extra_days = 0) → 14j classiques.
 *  - User parrainé qui s'abonne avant la fin de son 30j → on honore les jours
 *    restants pour ne pas le punir de convertir en avance.
 *  - User parrainé qui s'abonne après expiration → 0 (facturation immédiate).
 *
 *  Aligné avec le trial gate de /api/invoices/process (MAX(14, trial_extra_days))
 *  pour que la couverture Stripe matche exactement la couverture serveur. */
function computeStripeTrialDays(
  createdAt: string | null,
  trialExtraDays: number,
): number {
  if (trialExtraDays <= 0) return TRIAL_DAYS;
  if (!createdAt) return trialExtraDays;
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(trialExtraDays - elapsed));
}

/** URL publique de l'app pour les redirects Stripe. Priorité :
 *  1. NEXT_PUBLIC_APP_URL (à set sur Vercel = https://www.yieldapp.fr)
 *  2. header origin (utile en dev local + previews Vercel)
 *  3. fallback prod yieldapp.fr (jamais localhost en prod) */
function getAppUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL
    ?? req.headers.get("origin")
    ?? "https://www.yieldapp.fr"
  );
}

/**
 * Crée une session Stripe Checkout pour démarrer l'essai gratuit (14 jours)
 * + abonnement Lancement (19,99€/mois). Retourne `{ url }` à ouvrir côté
 * client. Le webhook /api/stripe/webhook prendra ensuite la main pour passer
 * `profiles.is_subscribed = true` quand le paiement est confirmé.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw internal("Stripe non configuré");
    }
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
    if (!priceId) {
      throw internal("NEXT_PUBLIC_STRIPE_PRICE_ID manquant — set le price ID Lancement (live) dans les env vars Vercel");
    }
    const { userId, email } = await authorizeBearer(req);
    if (!email) throw badRequest("Email du compte introuvable");

    // Lecture du profil côté service-role pour décider le trial Stripe.
    // Service-role (pas la session) parce que la route est appelée côté server.
    // Un échec de lecture ne doit PAS bloquer le checkout — fallback 14j.
    const { data: profile } = await getServiceClient()
      .from("profiles")
      .select("created_at, trial_extra_days")
      .eq("id", userId)
      .maybeSingle();
    const trialExtraDays = Math.max(
      0,
      Number((profile as { trial_extra_days?: number | null } | null)?.trial_extra_days) || 0,
    );
    const createdAt = (profile as { created_at?: string | null } | null)?.created_at ?? null;
    const trialPeriodDays = computeStripeTrialDays(createdAt, trialExtraDays);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const appUrl = getAppUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Si pas de trial (parrainé expiré) → on a besoin de la CB sinon Stripe
      // ne peut pas charger immédiatement. "if_required" gère les deux cas
      // proprement : pas de CB demandée quand il y a un trial, CB obligatoire
      // sinon.
      payment_method_collection: "if_required",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        // Stripe refuse trial_period_days = 0 → on omet le champ dans ce cas
        // (parrainé après expiration des 30j) pour facturer immédiatement.
        ...(trialPeriodDays > 0 ? { trial_period_days: trialPeriodDays } : {}),
        metadata: { supabase_user_id: userId },
      },
      customer_email: email,
      client_reference_id: userId,
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/dashboard?checkout=cancel`,
      allow_promotion_codes: true,
      locale: "fr",
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return apiErrorResponse(err, "checkout");
  }
}
