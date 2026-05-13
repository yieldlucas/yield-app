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

    // Aggregation côté SQL : on récupère pour chaque user_id le count de BL
    // processed dans la fenêtre + l'email. Plus efficace que loop côté Node.
    // On joint via profiles → restaurants → invoices (RLS service role bypass).
    type Row = {
      user_id: string;
      email: string;
      restaurant_name: string | null;
      invoices_count: number;
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

    const targets = (candidates ?? []) as Row[];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? req.headers.get("origin")
      ?? "https://www.yieldapp.fr";
    const dashboardUrl = `${appUrl}/dashboard`;

    let sent = 0;
    let failed = 0;

    for (const t of targets) {
      try {
        // Plus grosse hausse du mois pour ce user : 1 query par chef
        // (acceptable < 100 chefs/mois). Si volume monte, on précompute en RPC.
        const { data: topAlert } = await sb
          .from("margin_alerts")
          .select("price_change_pct, product:products(name)")
          .gte("created_at", monthStart.toISOString())
          .lt("created_at", monthEnd.toISOString())
          .order("price_change_pct", { ascending: false })
          .limit(1);
        const top = (topAlert?.[0] ?? null) as
          | { price_change_pct: number; product: { name: string } | null }
          | null;

        // Count des recettes existantes (à la date du cron).
        const { count: recipesCount } = await sb
          .from("recipes")
          .select("id", { count: "exact", head: true });

        // Count alertes du mois.
        const { count: alertsCount } = await sb
          .from("margin_alerts")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart.toISOString())
          .lt("created_at", monthEnd.toISOString());

        const firstName = t.restaurant_name?.trim() || "Chef";

        const ok = await sendMonthlyRecapEmail(t.email, {
          firstName,
          monthName,
          invoicesCount: t.invoices_count,
          alertsCount: alertsCount ?? 0,
          biggestRiseProduct: top?.product?.name ?? null,
          biggestRisePct: top?.price_change_pct ?? null,
          recipesCount: recipesCount ?? 0,
          dashboardUrl,
        });
        if (ok) sent++;
        else failed++;
      } catch (err) {
        captureException(err, "cron/monthly-recap", { userId: t.user_id });
        failed++;
      }
    }

    logger.info("cron/monthly-recap", "batch complete", {
      month: monthName,
      total: targets.length,
      sent,
      failed,
    });
    return NextResponse.json({ month: monthName, total: targets.length, sent, failed });
  } catch (err) {
    return apiErrorResponse(err, "cron/monthly-recap");
  }
}
