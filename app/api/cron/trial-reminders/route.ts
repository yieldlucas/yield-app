import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-admin";
import { apiErrorResponse, unauthorized } from "@/lib/api-error";
import { sendTrialReminderEmail } from "@/lib/emails";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/error-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron quotidien — envoie le rappel J-3 aux trials qui se terminent bientôt.
 *
 * Authentification : header `Authorization: Bearer ${CRON_SECRET}`.
 * C'est le pattern Vercel Cron : configurer dans vercel.json :
 *
 *   {
 *     "crons": [
 *       { "path": "/api/cron/trial-reminders", "schedule": "0 10 * * *" }
 *     ]
 *   }
 *
 * Et set `CRON_SECRET` dans les env vars Vercel (généré aléatoirement).
 *
 * Logique de fenêtrage : trial = 14 jours, on envoie à J+11 (= J-3 de fin).
 * Pour ne pas rater quelqu'un si le cron a 1 raté (panne, deploy), on prend
 * une fenêtre de 24h (created_at entre il y a 11.5j et il y a 10.5j).
 *
 * IDEMPOTENCY : aujourd'hui pas de garde — si le cron tourne 2x dans la même
 * journée, le user reçoit 2 emails. Pour fixer : ajouter une colonne
 * `trial_reminder_sent_at timestamptz` à profiles, filtrer where IS NULL,
 * marquer après envoi. Migration future si on observe le souci en prod.
 */
const TRIAL_DAYS = 14;
const REMINDER_LEAD_DAYS = 3; // J-3 de la fin du trial

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      throw unauthorized();
    }

    // Fenêtre [J-11.5d, J-10.5d] sur created_at (UTC).
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const elapsedMs = (TRIAL_DAYS - REMINDER_LEAD_DAYS) * dayMs; // 11 jours
    const windowEnd = new Date(now - (elapsedMs - dayMs / 2)).toISOString();   // J-10.5
    const windowStart = new Date(now - (elapsedMs + dayMs / 2)).toISOString(); // J-11.5

    const sb = getServiceClient();
    const { data: profiles, error } = await sb
      .from("profiles")
      .select("id, email, created_at, restaurant_name")
      .eq("is_subscribed", false)
      .gte("created_at", windowStart)
      .lt("created_at", windowEnd);

    if (error) {
      logger.error("cron/trial-reminders", "DB query failed", { message: error.message });
      throw new Error(error.message);
    }

    const targets = (profiles ?? []) as {
      id: string;
      email: string | null;
      created_at: string;
      restaurant_name: string | null;
    }[];

    // Pour un cron, origin est vide. On privilégie l'env var prod, fallback
    // explicite yieldapp.fr pour que les boutons des emails marchent toujours.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? req.headers.get("origin")
      ?? "https://yieldapp.fr";
    const dashboardUrl = `${appUrl}/dashboard`;
    // Le bouton CTA du mail trial-reminder pointe vers /billing (page dédiée
    // au tunnel d'achat — propose checkout direct ou portail si déjà subscribed).
    const checkoutUrl = `${appUrl}/billing`;

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const p of targets) {
      if (!p.email) {
        skipped++;
        continue;
      }
      try {
        // Stats personnalisées pour le contenu (preuve sociale interne).
        // 2 SELECTs par user — OK pour <100 trials/jour, à indexer si volume.
        const [{ count: scansCount }, { count: alertsCount }] = await Promise.all([
          sb.from("invoices").select("id", { count: "exact", head: true })
            .eq("status", "processed")
            .in("restaurant_id", await getRestaurantIds(sb, p.id)),
          sb.from("margin_alerts").select("id", { count: "exact", head: true })
            .in("restaurant_id", await getRestaurantIds(sb, p.id)),
        ]);

        const firstName = p.restaurant_name?.trim() || p.email.split("@")[0] || "chef";
        const ok = await sendTrialReminderEmail(p.email, {
          firstName,
          alertsCount: alertsCount ?? 0,
          scansCount: scansCount ?? 0,
          daysLeft: REMINDER_LEAD_DAYS,
          dashboardUrl,
          checkoutUrl,
        });
        if (ok) sent++;
        else failed++;
      } catch (err) {
        captureException(err, "cron/trial-reminders", { userId: p.id });
        failed++;
      }
    }

    logger.info("cron/trial-reminders", "batch complete", {
      total: targets.length,
      sent,
      skipped,
      failed,
    });
    return NextResponse.json({ total: targets.length, sent, skipped, failed });
  } catch (err) {
    return apiErrorResponse(err, "cron/trial-reminders");
  }
}

/** Liste les restaurant_id d'un user (pour scoper les counts). */
async function getRestaurantIds(
  sb: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<string[]> {
  const { data } = await sb.from("restaurants").select("id").eq("owner_id", userId);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}
