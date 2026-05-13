import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/emails";
import { apiErrorResponse, badRequest, unauthorized } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/error-tracking";
import { getServiceClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook déclenché par Supabase Database Webhook sur INSERT auth.users.
 *
 * Configuration côté Supabase Dashboard → Database → Webhooks :
 *   - Name           : auth-user-created
 *   - Table          : auth.users
 *   - Events         : INSERT
 *   - Type           : HTTP Request
 *   - Method         : POST
 *   - URL            : https://www.yieldapp.fr/api/webhooks/auth/user-created
 *   - HTTP Headers   : Authorization: Bearer ${SUPABASE_WEBHOOK_SECRET}
 *
 * Le secret partagé `SUPABASE_WEBHOOK_SECRET` doit être set dans Vercel ET
 * dans le header HTTP du webhook Supabase. Sans ça, n'importe qui pourrait
 * déclencher des envois d'emails sur n'importe quelle adresse.
 *
 * Pourquoi un webhook DB plutôt qu'un appel frontend après signUp() :
 *   - Fiabilité : marche même si l'user ferme l'onglet juste après signup.
 *   - Idempotence côté Supabase : retry automatique en cas de 5xx.
 *   - Pas d'impact UX (pas de blocage du flow signup pendant l'envoi).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const expected = process.env.SUPABASE_WEBHOOK_SECRET;
    if (!expected) {
      logger.error(
        "webhooks/auth/user-created",
        "SUPABASE_WEBHOOK_SECRET not set — refusing to process",
      );
      throw unauthorized();
    }
    if (auth !== `Bearer ${expected}`) throw unauthorized();

    type Payload = {
      type?: "INSERT" | "UPDATE" | "DELETE";
      table?: string;
      schema?: string;
      record?: {
        id?: string;
        email?: string;
        raw_user_meta_data?: Record<string, unknown>;
      };
    };
    const payload = (await req.json().catch(() => ({}))) as Payload;

    // Garde-fou : on ne traite que les INSERT sur auth.users. Si Supabase
    // envoie autre chose (mauvaise config), on ack 200 (pas de retry) et on log.
    if (payload.type !== "INSERT" || payload.table !== "users") {
      logger.warn("webhooks/auth/user-created", "ignored event", {
        type: payload.type,
        table: payload.table,
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    const email = payload.record?.email;
    const userId = payload.record?.id;
    if (!email) throw badRequest("Email manquant dans le payload");
    if (!userId) throw badRequest("ID utilisateur manquant dans le payload");

    // Assignation founder_number + referral_code via RPC.
    // La fonction est idempotente : si déjà rempli (cas d'un retry webhook),
    // elle ne touche pas. On la fait BEFORE le welcome email pour que le
    // mail puisse en théorie inclure le numéro (pas utilisé pour l'instant
    // mais utile si on enrichit le template plus tard).
    try {
      const sb = getServiceClient();
      const { error: rpcErr } = await sb.rpc("assign_founder_metadata", {
        p_user_id: userId,
      });
      if (rpcErr) {
        // Non-bloquant : si la migration 016 n'est pas encore appliquée
        // (relation does not exist), on log et on continue. Le user pourra
        // se voir attribuer un numéro plus tard via le backfill.
        logger.warn("webhooks/auth/user-created", "assign_founder_metadata failed", {
          code: (rpcErr as { code?: string }).code,
          message: rpcErr.message,
        });
      }
    } catch (err) {
      logger.warn("webhooks/auth/user-created", "assign_founder_metadata threw", { err: String(err) });
    }

    // Pas encore de profile.restaurant_name à ce stade (saisi à l'onboarding
    // après le 1er login). On utilise la partie locale de l'email comme
    // approximation — sera "chef" si l'email est bizarre.
    const firstName = email.split("@")[0]?.trim() || "chef";

    // Le header origin est absent quand Supabase appelle ce webhook (serveur
    // à serveur). On privilégie NEXT_PUBLIC_APP_URL pour que le bouton du
    // mail welcome pointe sur https://www.yieldapp.fr et pas un fallback hasardeux.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? req.headers.get("origin")
      ?? "https://www.yieldapp.fr";
    const dashboardUrl = `${appUrl}/dashboard`;

    const sent = await sendWelcomeEmail(email, { firstName, dashboardUrl });
    return NextResponse.json({ sent, userId: payload.record?.id });
  } catch (err) {
    // captureException avant la réponse — on veut être alertés sur les
    // pannes de signup welcome, c'est critique pour la conversion.
    if (!(err instanceof Error && err.name === "ApiError")) {
      captureException(err, "webhooks/auth/user-created");
    }
    return apiErrorResponse(err, "webhooks/auth/user-created");
  }
}
