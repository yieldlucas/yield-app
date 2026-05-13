import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-admin";
import { apiErrorResponse, unauthorized } from "@/lib/api-error";
import { sendMonthlyRecapEmail } from "@/lib/emails";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/error-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron mensuel — envoie le récap "Votre mois en Yield" le 1er de chaque mois.
 *
 * Configuration vercel.json :
 *   {
 *     "crons": [
 *       { "path": "/api/cron/monthly-recap", "schedule": "0 9 1 * *" }
 *     ]
 *   }
 *   → 9h le 1er de chaque mois (cron Vercel = UTC).
 *
 * Filtre : on n'envoie qu'aux chefs ayant scanné >= MIN_SCANS_FOR_RECAP BL
 * dans le mois écoulé. Sinon un récap "0 BL ce mois" est démoralisant.
 *
 * IDEMPOTENCY : pas de garde aujourd'hui. Si Vercel re-trigger le cron dans la
 * journée (panne, redéploiement), le chef peut recevoir 2 mails. À fixer si on
 * observe en prod (colonne profiles.last_monthly_recap_sent_at + filtre).
 */

const MIN_SCANS_FOR_RECAP = 5;

const MONTH_NAMES_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      throw unauthorized();
    }

    // Bornes du mois écoulé (UTC).
    const now = new Date();
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const monthName = MONTH_NAMES_FR[monthStart.getUTCMonth()];

    const sb = getServiceClient();

    // Aggregation côté SQL via RPC : pour chaque user_id éligible, on récupère
    // en une passe count de BL + count alertes du mois + top hausse + count
    // recettes — TOUT SCOPÉ par user_id côté Postgres (CTE user_restaurants).
    // Migration 020 a fixé un bug critique : avant, les stats secondaires
    // (top alerte, count alertes, count recettes) étaient queries globales
    // non scopées → chaque chef recevait les stats de toute la base.
    type Row = {
      user_id: string;
      email: string;
      restaurant_name: string | null;
      invoices_count: number;
      alerts_count_period: number;
      recipes_total: number;
      top_rise_product: string | null;
      top_rise_pct: number | null;
    };

    const { data: candidates, error: candidatesErr } = await sb.rpc(
      "monthly_recap_candidates",
      {
        p_month_start: monthStart.toISOString(),
        p_month_end: monthEnd.toISOString(),
        p_min_scans: MIN_SCANS_FOR_RECAP,
      },
    );

    if (candidatesErr) {
      // Fallback si la fonction RPC n'existe pas encore (migration en retard)
      // → on log et bail proprement, plutôt que 500 le cron.
      logger.warn("cron/monthly-recap", "RPC monthly_recap_candidates absent — skip", {
        message: candidatesErr.message,
      });
      return NextResponse.json({ ok: true, skipped: true });
    }

    const allCandidates = (candidates ?? []) as Row[];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? req.headers.get("origin")
      ?? "https://www.yieldapp.fr";
    const dashboardUrl = `${appUrl}/dashboard`;

    // Idempotency : on filtre les users déjà notifiés ce mois-ci. Si le cron
    // est re-trigger (panne, redéploiement), on skip plutôt que d'envoyer
    // un 2e mail. Best-effort : si la colonne n'existe pas (migration 020
    // pas appliquée), la query bail vers le fallback (tous éligibles).
    const userIds = allCandidates.map((c) => c.user_id);
    let alreadySent = new Set<string>();
    if (userIds.length > 0) {
      const { data: sentRows } = await sb
        .from("profiles")
        .select("id, last_monthly_recap_sent_at")
        .in("id", userIds)
        .gte("last_monthly_recap_sent_at", monthEnd.toISOString());
      alreadySent = new Set(
        ((sentRows ?? []) as { id: string }[]).map((r) => r.id),
      );
    }
    const targets = allCandidates.filter((t) => !alreadySent.has(t.user_id));

    let sent = 0;
    let failed = 0;
    let skipped = allCandidates.length - targets.length;

    for (const t of targets) {
      try {
        const firstName = t.restaurant_name?.trim() || "Chef";
        const ok = await sendMonthlyRecapEmail(t.email, {
          firstName,
          monthName,
          invoicesCount: Number(t.invoices_count) || 0,
          alertsCount: Number(t.alerts_count_period) || 0,
          biggestRiseProduct: t.top_rise_product,
          biggestRisePct: t.top_rise_pct,
          recipesCount: Number(t.recipes_total) || 0,
          dashboardUrl,
        });
        if (ok) {
          sent++;
          // Marque l'envoi → idempotency lors d'un éventuel re-trigger.
          await sb
            .from("profiles")
            .update({ last_monthly_recap_sent_at: new Date().toISOString() })
            .eq("id", t.user_id);
        } else {
          failed++;
        }
      } catch (err) {
        captureException(err, "cron/monthly-recap", { userId: t.user_id });
        failed++;
      }
    }

    logger.info("cron/monthly-recap", "batch complete", {
      month: monthName,
      total: allCandidates.length,
      sent,
      skipped,
      failed,
    });
    return NextResponse.json({
      month: monthName,
      total: allCandidates.length,
      sent,
      skipped,
      failed,
    });
  } catch (err) {
    return apiErrorResponse(err, "cron/monthly-recap");
  }
}
