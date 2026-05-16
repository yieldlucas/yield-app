// Fix audit I4 — Configuration Sentry côté client (browser bundle).
// Chargé automatiquement par @sentry/nextjs au boot de l'app côté navigateur.
//
// Mêmes notes que sentry.server.config.ts sur la distinction sampleRate
// (erreurs, 1.0 par défaut) vs tracesSampleRate (perfs, 0.1).
//
// Spécifique client : Session Replays désactivés (replaysSessionSampleRate
// et replaysOnErrorSampleRate à 0). Cette feature enregistre tout ce que
// l'utilisateur fait à l'écran — utile mais bouffe massivement le quota
// free tier. À envisager seulement quand on aura un quota payant et un
// besoin debug spécifique.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // sampleRate par défaut 1.0 — toutes les erreurs client capturées.

    tracesSampleRate: 0.1,

    // Replays explicitement désactivés (économie quota).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "unknown",

    // Filtrage PII (RGPD). Les champs scrubés doivent rester alignés
    // avec lib/logger.ts PII_KEYS et sentry.server.config.ts.
    beforeSend(event) {
      return scrubPIIFromEvent(event);
    },
  });
}

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
