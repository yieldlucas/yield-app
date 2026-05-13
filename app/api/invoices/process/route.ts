import { NextRequest, NextResponse, after } from "next/server";
import { authorizeBearer } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-admin";
import {
  ApiError,
  apiErrorResponse,
  badRequest,
  internal,
  paymentRequired,
  tooManyRequests,
} from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/error-tracking";

export const runtime = "nodejs";
// Vercel max duration : Pro = 60s, Hobby = 10s. Le scan IA peut prendre 15-25s
// par BL, donc on autorise jusqu'à 60s pour rester safe sur Pro.
export const maxDuration = 60;

// Quota mensuel inclus dans l'offre Lancement (19,99 € HT). Le compteur se
// réinitialise au 1er du mois (RPC check_and_increment_scan_usage). Un futur
// forfait Pro (illimité + comptabilité) est en préparation. Voir migration 005.
const MONTHLY_SCAN_QUOTA = 200;
const TRIAL_DAYS = 14;

/**
 * Pipeline d'ingestion d'une facture :
 *  1. Auth Bearer (cohérent avec le reste de l'API)
 *  2. Rate limit burst (max 5 scans / 2 min — protection budget Anthropic)
 *  3. Gate abonnement : trial 14j OU is_subscribed
 *  4. Restaurant lazy-create
 *  5. Réservation atomique du quota mensuel (RPC check_and_increment)
 *  6. Upload Storage + insert facture (status: pending)
 *  7. Délègue à la Supabase Edge Function en fire-and-forget
 *
 * Compensation : si le pipeline échoue après l'étape 5, on appelle
 * `decrement_scan_usage` pour rendre le crédit au user (le scan n'a pas
 * abouti). Voir migration 009.
 */
export async function POST(request: NextRequest) {
  // Capturé hors du try pour pouvoir l'inclure dans le contexte Sentry
  // (captureException) même si l'erreur survient avant que userId soit assigné.
  let userId: string | undefined;

  try {
    const bearer = await authorizeBearer(request);
    userId = bearer.userId;
    const { email, supabase, accessToken } = bearer;

    // ─── Rate limit burst (migration 012) ───
    // 5 scans / 2 min par user_id. Garde-fou court-terme contre le spam,
    // distinct du quota mensuel (qui couvre la marge logique long-terme).
    // Évalué AVANT toute autre lecture DB pour couper net les abuseurs.
    const { data: rateLimitRow, error: rateLimitErr } = await supabase
      .rpc("check_scan_rate_limit", { p_user_id: userId })
      .single();
    if (rateLimitErr) throw internal("Erreur lors de la vérification du rate limit", rateLimitErr);
    const rl = rateLimitRow as { allowed: boolean; retry_after_seconds: number };
    if (!rl.allowed) {
      throw tooManyRequests(
        "Vitesse de scan trop rapide, soufflez un peu !",
        rl.retry_after_seconds,
      );
    }

    // ─── Gate abonnement : essai gratuit 14 jours OU is_subscribed = true ───
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("is_subscribed, created_at, trial_extra_days")
      .eq("id", userId)
      .maybeSingle();

    const profile = profileRow as {
      is_subscribed?: boolean;
      created_at?: string;
      trial_extra_days?: number;
    } | null;
    const isSubscribed = Boolean(profile?.is_subscribed);
    const createdAt = profile?.created_at ? new Date(profile.created_at) : null;
    // trial_extra_days est crédité +30 par filleul accepté (migration 017).
    // S'additionne aux 14 jours de base. Cumulable (parrainages multiples).
    const trialExtraDays = Math.max(0, Number(profile?.trial_extra_days) || 0);
    const trialMs = (TRIAL_DAYS + trialExtraDays) * 24 * 60 * 60 * 1000;
    let trialActive = createdAt ? Date.now() - createdAt.getTime() < trialMs : false;

    // Anti-fraude trial : un user qui se ré-inscrit avec un alias email
    // (foo+1@gmail) ou en variant la casse n'a pas droit à un nouveau trial.
    // Comparé via normalized_email (calculé par trigger DB, migration 004).
    if (trialActive && createdAt && email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = getServiceClient();
      const normalized = email.toLowerCase().replace(/\+[^@]*@/, "@");
      const { data: olderTwin } = await adminClient
        .from("profiles")
        .select("id")
        .eq("normalized_email", normalized)
        .neq("id", userId)
        .lt("created_at", createdAt.toISOString())
        .limit(1)
        .maybeSingle();
      if (olderTwin) trialActive = false;
    }

    if (!isSubscribed && !trialActive) {
      throw paymentRequired(
        "Votre essai gratuit de 14 jours est terminé. Abonnez-vous pour continuer à scanner.",
        "SUBSCRIPTION_REQUIRED",
      );
    }

    // ─── Restaurant (lazy create au premier scan) ───
    let { data: restaurant } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();

    if (!restaurant) {
      const { data: profileForName } = await supabase
        .from("profiles")
        .select("restaurant_name")
        .eq("id", userId)
        .maybeSingle();
      const restaurantName =
        (profileForName as { restaurant_name?: string } | null)?.restaurant_name?.trim() ||
        "Mon restaurant";

      const { data: created, error: createErr } = await supabase
        .from("restaurants")
        .insert({ owner_id: userId, name: restaurantName })
        .select("id")
        .single();

      if (createErr || !created) {
        throw internal("Impossible de créer votre restaurant. Réessayez ou contactez le support.", createErr);
      }
      restaurant = created;
    }
    const restaurantId = restaurant.id;

    // ─── Réservation atomique du quota mensuel (migration 009) ───
    // check_and_increment_scan_usage fait check + reserve dans une seule
    // transaction avec FOR UPDATE → plus de race condition entre 2 requêtes
    // simultanées qui passeraient toutes deux la vérification avant que
    // l'incrément ne soit appliqué.
    //
    // Si le scan échoue après ce point, on appelle decrement_scan_usage
    // (compensation) pour rendre le crédit au user.
    const { data: quotaRow, error: quotaErr } = await supabase
      .rpc("check_and_increment_scan_usage", {
        p_restaurant_id: restaurantId,
        p_quota: MONTHLY_SCAN_QUOTA,
      })
      .single();

    if (quotaErr) throw internal("Erreur lors de la vérification du quota", quotaErr);

    const quota = quotaRow as { allowed: boolean; used: number; quota: number };
    if (!quota.allowed) {
      throw paymentRequired(
        `Vous avez utilisé l'intégralité de votre forfait mensuel (${quota.quota} scans). Le compteur sera réinitialisé le 1er du mois prochain. Un forfait Pro illimité + espace comptable est en préparation.`,
        "QUOTA_EXCEEDED",
        { quota: quota.quota, used: quota.used },
      );
    }

    // À partir d'ici, le quota est RÉSERVÉ. Toute sortie en erreur doit
    // appeler releaseQuotaSlot() pour ne pas brûler le crédit du user.
    let quotaCommitted = false;
    const releaseQuotaSlot = async () => {
      if (quotaCommitted) return;
      try {
        const admin = getServiceClient();
        await admin.rpc("decrement_scan_usage", { p_restaurant_id: restaurantId });
      } catch (e) {
        logger.error("invoices/process", "decrement_scan_usage failed", { error: e });
      }
    };

    try {
      // ─── Validation fichier ───
      const formData = await request.formData();
      const file = formData.get("invoice") as File | null;
      if (!file) throw badRequest("Fichier manquant");

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        throw badRequest("Format non supporté. Utilisez JPEG, PNG, WebP ou PDF.");
      }
      if (file.size > 20 * 1024 * 1024) {
        throw badRequest("Fichier trop volumineux (max 20 Mo).");
      }

      // ─── Upload Storage ───
      const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const storagePath = `${restaurantId}/${Date.now()}-${safeFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(storagePath, file, { contentType: file.type });

      if (uploadError) throw internal("Erreur lors de l'upload de l'image", uploadError);

      // ─── Insert facture (status: pending) ───
      // content_type stocké pour que l'edge function distingue image vs PDF
      // sans dépendre de l'extension du filename (parfois absente ou tordue).
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          restaurant_id: restaurantId,
          image_path: storagePath,
          content_type: file.type || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (invoiceError || !invoice) {
        throw internal("Erreur lors de la création de la facture", invoiceError);
      }

      // ─── Délègue à la Supabase Edge Function en fire-and-forget ───
      // `after()` (Next 15) garantit que le fetch est envoyé même après le return.
      // Si le fetch échoue côté réseau, on marque la facture en erreur ET on
      // libère le slot de quota — dans le cas heureux, l'edge function ira
      // jusqu'au bout et ne touchera pas au quota (il est déjà réservé ici).
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-invoice`;

      const markInvoiceFailedAndRelease = async (id: string) => {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
        try {
          const adminClient = getServiceClient();
          await adminClient.from("invoices").update({ status: "error" }).eq("id", id);
        } catch (e) {
          logger.error("invoices/process", "markInvoiceFailed (status update) threw", { error: e });
        }
        await releaseQuotaSlot();
      };

      after(async () => {
        try {
          const res = await fetch(edgeFunctionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            },
            body: JSON.stringify({ invoice_id: invoice.id }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            logger.error("invoices/process", "edge function failed", {
              status: res.status,
              body,
            });
            // L'edge function gère elle-même son propre release sur status='error'
            // ou 'duplicate'. On ne double-release pas.
            if (res.status >= 500) {
              // Crash côté edge function = bug à investiguer → Sentry.
              captureException(
                new Error(`Edge function 5xx: ${res.status}`),
                "invoices/process/edge",
                { invoiceId: invoice.id, userId, status: res.status, body },
              );
              await markInvoiceFailedAndRelease(invoice.id);
            }
          }
        } catch (err) {
          // Réseau / DNS / timeout : l'edge function n'a peut-être jamais tourné,
          // donc personne d'autre ne va marquer la facture en erreur ni libérer
          // le crédit. À nous de le faire — ET on Sentry-track parce que c'est
          // typiquement un signe de panne (DNS, timeout Vercel, edge offline).
          captureException(err, "invoices/process/edge-fetch", {
            invoiceId: invoice.id,
            userId,
          });
          await markInvoiceFailedAndRelease(invoice.id);
        }
      });

      // Le slot de quota est "committed" tant que le scan se déroule normalement.
      // L'edge function le libère elle-même si le scan échoue (status='error' ou
      // 'duplicate'). Voir process-invoice/index.ts.
      quotaCommitted = true;

      return NextResponse.json({ invoice_id: invoice.id, status: "pending" }, { status: 202 });
    } catch (innerErr) {
      // Toute erreur entre la réservation et le fire de l'edge function →
      // libération immédiate du slot.
      await releaseQuotaSlot();
      throw innerErr;
    }
  } catch (err) {
    // Sentry track : on alerte uniquement sur les vraies exceptions (5xx ou
    // erreurs non-gérées). Les ApiError 4xx attendues (rate limit, quota,
    // payment required, fichier manquant…) sont du flow normal — pas la peine
    // de réveiller quelqu'un.
    const shouldAlert = !(err instanceof ApiError) || err.status >= 500;
    if (shouldAlert) {
      captureException(err, "invoices/process", userId ? { userId } : undefined);
    }
    return apiErrorResponse(err, "invoices/process");
  }
}
