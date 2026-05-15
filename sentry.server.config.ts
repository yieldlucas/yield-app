// Fix audit I4 — Configuration Sentry côté serveur (Node.js serverless functions
// Next.js : routes API, server components, server actions). Chargé par
// instrumentation.ts quand process.env.NEXT_RUNTIME === "nodejs".
//
// IMPORTANT — distinguer 2 notions de sampling :
//   - sampleRate (par défaut 1.0)        → fraction des ERREURS capturées
//   - tracesSampleRate (configuré 0.1)  → fraction des transactions PERFORMANCE
// On garde sampleRate à 1.0 (toutes les erreurs remontent — c'est le but du
// monitoring) et on baisse tracesSampleRate à 0.1 pour économiser le quota
// free tier Sentry (5000 errors + 10000 perf events/mois).

import * as Sentry from "@sentry/nextjs";

// Graceful fallback : sans DSN configuré (dev local, preview oubliée),
// l'init Sentry est skippée et l'app ne crashe pas. Les call sites de
// lib/error-tracking continuent de logger via lib/logger seul.
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // sampleRate par défaut = 1.0 (toutes les erreurs capturées).
    // NE PAS toucher tant qu'on n'a pas >2000 erreurs/mois en prod —
    // sur un projet à 15 ambassadeurs en bêta, on veut TOUT.

    tracesSampleRate: 0.1,

    // Release tracking : Vercel injecte VERCEL_GIT_COMMIT_SHA dans
    // les déploiements. Chaque erreur sera taggée avec le hash de
    // commit pour traçabilité post-mortem. En dev local → "unknown".
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",

    // Filtrage PII (RGPD + paranoia logs externes). Les champs scrubés
    // doivent rester alignés avec lib/logger.ts PII_KEYS.
    beforeSend(event) {
      return scrubPIIFromEvent(event);
    },
  });
}

// Helper récursif qui redacte les valeurs des clés PII dans tout l'event
// Sentry (extra, contexts, request.data, etc.). Garde la structure intacte
// pour le debug (stack, url, browser…), neutralise uniquement les valeurs
// sensibles. À synchroniser avec lib/logger.ts PII_KEYS si on étend la liste.
const PII_KEYS = new Set([
  "email",
  "raw_label",
  "name",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "apikey",
  "api_key",
]);

function scrubPIIFromEvent<T>(event: T): T {
  // Cast typage Sentry souple : on traverse en mode object/array agnostique.
  return scrubValue(event as unknown) as T;
}

function scrubValue(v: unknown, depth = 0): unknown {
  if (v == null || depth > 6) return v;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map((x) => scrubValue(x, depth + 1));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = PII_KEYS.has(k.toLowerCase()) ? "[redacted]" : scrubValue(val, depth + 1);
    }
    return out;
  }
  return v;
}
