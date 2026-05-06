import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { authorizeBearer } from "@/lib/api-auth";
import { apiErrorResponse, internal, notFound } from "@/lib/api-error";

export const runtime = "nodejs";

/**
 * Crée une session Stripe Billing Portal pour qu'un user abonné gère son
 * paiement, télécharge ses factures, ou résilie. Le `stripe_customer_id`
 * est lu depuis profiles (alimenté par le webhook checkout.session.completed).
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw internal("Stripe non configuré");
    }
    const { userId, supabase } = await authorizeBearer(req);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw internal("Erreur lecture profil", profileError);
    const customerId = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id;
    if (!customerId) throw notFound("Aucun abonnement actif sur ce compte");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return apiErrorResponse(err, "billing/portal");
  }
}
