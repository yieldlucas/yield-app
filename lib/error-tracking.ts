// Helper d'observabilité — log structuré + remontée Sentry conditionnelle.
//
// Fix audit I4 — l'API publique (captureException, captureMessage) est
// inchangée par rapport à la version pre-Sentry. Les 8 call sites existants
// (process invoice, webhooks signup, crons, emails Resend) continuent de
// fonctionner sans modification. On ajoute simplement la remontée Sentry
// EN PLUS du log structuré quand SENTRY_DSN est configuré.
//
// Fallback gracieux : si SENTRY_DSN n'est pas défini (dev local, instance
// préprod sans monitoring), les fonctions ne font plus que loguer via
// lib/logger (PII-scrubbed). Pas de crash, pas de message bruyant.

import * as Sentry from "@sentry/nextjs";
import { logger } from "./logger";

type ErrorContext = Record<string, unknown>;

// Détection one-shot de la disponibilité Sentry. On lit l'env var côté
// serveur (process.env.SENTRY_DSN) ET côté client (NEXT_PUBLIC_SENTRY_DSN).
// Sentry.init est appelé dans sentry.{server,client,edge}.config.ts —
// ici on ne fait que router l'appel sans réinitialiser.
const isSentryEnabled =
  Boolean(process.env.SENTRY_DSN) ||
  (typeof process !== "undefined" && Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN));

/**
 * Capture une exception côté serveur. À appeler dans les `catch` critiques
 * des routes API (process invoice, webhooks, etc.) pour qu'on soit alerté
 * si un scan crash en prod.
 *
 * @param err l'erreur capturée
 * @param scope identifiant court de l'origine (ex: "invoices/process")
 * @param context métadonnées additionnelles (userId, invoiceId, etc.)
 *                — passées à Sentry dans `extra` et tagguées avec `scope`.
 *                Le filtrage PII est appliqué côté Sentry (beforeSend dans
 *                sentry.server.config.ts) ET côté logger (PII_KEYS).
 */
export function captureException(
  err: unknown,
  scope: string,
  context?: ErrorContext,
): void {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(scope, `Unhandled exception: ${message}`, { ...context, error: err });

  if (isSentryEnabled) {
    Sentry.captureException(err, {
      tags: { scope },
      extra: context,
    });
  }
}

/**
 * Capture un message structuré (pas une exception). Utile pour signaler des
 * conditions anormales mais non-bloquantes : webhook orphelin, fallback
 * dégradé, edge function 5xx remonté par le caller, etc.
 */
export function captureMessage(
  level: "info" | "warn" | "error",
  scope: string,
  message: string,
  context?: ErrorContext,
): void {
  if (level === "error") logger.error(scope, message, context);
  else if (level === "warn") logger.warn(scope, message, context);
  else logger.info(scope, message, context);

  if (isSentryEnabled) {
    // Mapping de notre alias "warn" vers le SeverityLevel Sentry "warning"
    // (Sentry n'accepte pas "warn"). "info" et "error" sont identiques.
    const sentryLevel = level === "warn" ? "warning" : level;
    Sentry.captureMessage(message, {
      level: sentryLevel,
      tags: { scope },
      extra: context,
    });
  }
}
