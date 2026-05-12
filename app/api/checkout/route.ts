import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { authorizeBearer } from "@/lib/api-auth";
import { apiErrorResponse, badRequest, internal } from "@/lib/api-error";

export const runtime = "nodejs";

const TRIAL_DAYS = 14;

/** URL publique de l'app pour les redirects Stripe. Priorité :
 *  1. NEXT_PUBLIC_APP_URL (à set sur Vercel = https://yieldapp.fr)
 *  2. header origin (utile en dev local + previews Vercel)
 *  3. fallback prod yieldapp.fr (jamais localhost en prod) */
function getAppUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL
    ?? req.headers.get("origin")
    ?? "https://yieldapp.fr"
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

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const appUrl = getAppUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_collection: "if_required",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
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
