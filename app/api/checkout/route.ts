import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { authorizeBearer } from "@/lib/api-auth";
import { apiErrorResponse, badRequest, internal } from "@/lib/api-error";

export const runtime = "nodejs";

const PRICE_ID = "price_1TPjSTDhKLnU8Or6UJi7p4mQ";
const TRIAL_DAYS = 14;

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
    const { userId, email } = await authorizeBearer(req);
    if (!email) throw badRequest("Email du compte introuvable");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_collection: "if_required",
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { supabase_user_id: userId },
      },
      customer_email: email,
      client_reference_id: userId,
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/dashboard?checkout=cancel`,
      allow_promotion_codes: true,
      locale: "fr",
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return apiErrorResponse(err, "checkout");
  }
}
