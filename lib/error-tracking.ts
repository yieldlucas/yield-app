// Helper d'observabilité Sentry-ready.
//
// Aujourd'hui : log structuré via lib/logger (PII-scrubbed). Visible dans les
// Vercel Function Logs.
//
// Demain — pour brancher Sentry (~10 min de boulot, fortement recommandé
// avant le 1er client payant) :
//   1. npm install @sentry/nextjs
//   2. npx @sentry/wizard@latest -i nextjs   (génère sentry.{client,server,edge}.config.ts)
//   3. Remplacer le bloc TODO ci-dessous par :
//        Sentry.captureException(err, { extra: context, tags: { scope } });
//      et idem pour captureMessage. La signature de ce helper reste inchangée.
//
// La couche d'abstraction permet de swapper Sentry → Logflare / Datadog /
// autre sans toucher aux call sites.

import { logger } from "./logger";

type ErrorContext = Record<string, unknown>;

/**
 * Capture une exception côté serveur. À appeler dans les `catch` critiques
 * des routes API (process invoice, webhooks, etc.) pour qu'on soit alerté
 * si un scan crash en prod.
 *
 * @param err l'erreur capturée
 * @param scope identifiant court de l'origine (ex: "invoices/process")
 * @param context métadonnées additionnelles (userId, invoiceId, etc.)
 *                — passées par référence à Sentry quand le SDK sera branché.
 *                Le logger scrub PII automatiquement.
 */
export function captureException(
  err: unknown,
  scope: string,
  context?: ErrorContext,
): void {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(scope, `Unhandled exception: ${message}`, { ...context, error: err });
  // TODO: when @sentry/nextjs is installed and SENTRY_DSN is set:
  //   Sentry.captureException(err, { extra: context, tags: { scope } });
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
  // TODO: when @sentry/nextjs is installed:
  //   Sentry.captureMessage(message, { level, extra: context, tags: { scope } });
}
