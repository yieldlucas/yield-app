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

    // Le trial gate utilise MAX(14, trial_extra_days). Pour un parrainé
    // (+30j), la vraie fin est à J+30, pas J+14. On ne peut pas pré-calculer
    // une fenêtre simple côté DB sans connaitre le trialExtraDays de chaque
    // profil → on récupère TOUS les non-abonnés des 90 derniers jours puis
    // on filtre côté Node par fenêtre J-3 relative à leur essai effectif.
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = new Date(now - 90 * dayMs).toISOString();

    const sb = getServiceClient();
    const { data: profiles, error } = await sb
      .from("profiles")
      .select("id, email, created_at, restaurant_name, trial_extra_days, trial_reminder_sent_at")
      .eq("is_subscribed", false)
      .gte("created_at", ninetyDaysAgo)
      .is("trial_reminder_sent_at", null);

    if (error) {
      logger.error("cron/trial-reminders", "DB query failed", { message: error.message });
      throw new Error(error.message);
    }

    const rawTargets = (profiles ?? []) as {
      id: string;
      email: string | null;
      created_at: string;
      restaurant_name: string | null;
      trial_extra_days: number | null;
      trial_reminder_sent_at: string | null;
    }[];

    // Filtre côté Node : on garde uniquement ceux qui sont dans la fenêtre
    // J-3 de leur essai EFFECTIF (14 ou 30+ selon trial_extra_days).
    // Fenêtre tolérante de ±12h pour absorber un raté de cron sans rater
    // l'envoi du lendemain.
    const targets = rawTargets.filter((p) => {
      const extra = Math.max(0, Number(p.trial_extra_days) || 0);
      const effectiveTrialDays = Math.max(TRIAL_DAYS, extra);
      const trialEndMs = new Date(p.created_at).getTime() + effectiveTrialDays * dayMs;
      const msToEnd = trialEndMs - now;
      const lowerBound = (REMINDER_LEAD_DAYS - 0.5) * dayMs;
      const upperBound = (REMINDER_LEAD_DAYS + 0.5) * dayMs;
      return msToEnd >= lowerBound && msToEnd <= upperBound;
    });

    // Pour un cron, origin est vide. On privilégie l'env var prod, fallback
    // explicite yieldapp.fr pour que les boutons des emails marchent toujours.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? req.headers.get("origin")
      ?? "https://www.yieldapp.fr";
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
        if (ok) {
          sent++;
          // Idempotency : marque l'envoi pour qu'un retry du cron dans la
          // même journée ne ré-envoie pas le mail. Best-effort — si l'UPDATE
          // échoue (RLS, perte de connexion), au pire le user reçoit 2 mails.
          await sb
            .from("profiles")
            .update({ trial_reminder_sent_at: new Date().toISOString() })
            .eq("id", p.id);
        } else {
          failed++;
        }
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
