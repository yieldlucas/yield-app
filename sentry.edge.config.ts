// Fix audit I4 — Configuration Sentry côté edge runtime Next.js (middleware
// + routes API marquées export const runtime = "edge"). Chargé par
// instrumentation.ts quand process.env.NEXT_RUNTIME === "edge".
//
// IMPORTANT : ce fichier concerne UNIQUEMENT le edge runtime Next.js
// (Vercel Edge / middleware.ts), PAS l'edge function Supabase Deno
// (supabase/functions/process-invoice/index.ts) qui tourne sur un autre
// runtime (Deno isolé) et nécessite @sentry/deno avec un setup distinct.
// Voir docs/deployment-notes.md section "Fix I4" pour le TODO Supabase.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
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
