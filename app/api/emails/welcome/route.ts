import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/api-auth";
import { apiErrorResponse, badRequest } from "@/lib/api-error";
import { sendWelcomeEmail } from "@/lib/emails";

export const runtime = "nodejs";

/**
 * Envoie l'email de bienvenue au user authentifié.
 *
 * Wiring suggéré (à choisir par le client) :
 *   1. Frontend : appelé après `supabase.auth.signUp` réussi (UX simple)
 *   2. Auth Hook Supabase : webhook DB sur INSERT auth.users → fetch ici
 *      (plus fiable, fonctionne même si l'user ferme l'onglet)
 *
 * L'endpoint est idempotent : appeler 2 fois enverra 2 emails. Pour idempotency
 * dure, ajouter un flag `welcome_email_sent_at` à profiles si besoin.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, email, supabase } = await authorizeBearer(req);
    if (!email) throw badRequest("Email du compte introuvable");

    // Récupère un prénom utilisable : profiles.restaurant_name (saisi à
    // l'onboarding) en priorité, sinon partie locale de l'email.
    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_name")
      .eq("id", userId)
      .maybeSingle();
    const restaurantName = (profile as { restaurant_name?: string } | null)?.restaurant_name?.trim();
    const firstName = restaurantName || email.split("@")[0] || "chef";

    // Priorité NEXT_PUBLIC_APP_URL pour ne pas envoyer un lien vers
    // un preview Vercel ou pire localhost en email.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? req.headers.get("origin")
      ?? "https://www.yieldapp.fr";
    const dashboardUrl = `${appUrl}/dashboard`;

    const sent = await sendWelcomeEmail(email, { firstName, dashboardUrl });
    return NextResponse.json({ sent });
  } catch (err) {
    return apiErrorResponse(err, "emails/welcome");
  }
}
