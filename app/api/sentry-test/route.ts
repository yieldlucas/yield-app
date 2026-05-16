// Fix audit I4 — endpoint de validation Sentry. À appeler UNE FOIS après
// configuration du DSN en production pour vérifier que les erreurs
// remontent bien dans le dashboard Sentry. PAS pour monitoring continu.
//
// Protection en 3 couches :
//   1. AUDIT_SENTRY_TEST_SECRET absent → 404 (endpoint invisible)
//   2. Secret fourni dans ?secret= != env var → 401
//   3. Rate limit en mémoire 1 appel / minute (anti-spam quota Sentry)
//
// Procédure de test documentée dans docs/deployment-notes.md.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limit en mémoire (process-level, reset au cold start). Suffisant pour
// un endpoint de test qui ne doit pas être hammered. Map keyed par secret
// pour ne pas pénaliser des secrets différents (peu probable, mais propre).
const lastCallByKey = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.AUDIT_SENTRY_TEST_SECRET;

  // Couche 1 : env var absente → endpoint désactivé entièrement.
  if (!expectedSecret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Couche 2 : auth par secret en query.
  const providedSecret = req.nextUrl.searchParams.get("secret");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Couche 3 : rate limit 1/min.
  const now = Date.now();
  const last = lastCallByKey.get(expectedSecret) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    const retryIn = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: `Rate limited. Réessaie dans ${retryIn}s.` },
      { status: 429 },
    );
  }
  lastCallByKey.set(expectedSecret, now);

  // Message explicite AVANT le throw pour que Lucas comprenne immédiatement
  // ce qui se passe (la réponse HTTP n'arrivera pas à cause du throw, mais
  // c'est documenté dans deployment-notes pour le contexte).
  //
  // NB : on throw une vraie Error pour que Sentry capture stack trace +
  // tags. L'instrumentation Next.js (instrumentation.ts → captureRequestError)
  // remonte ça automatiquement.
  throw new Error(
    "[audit-fix I4] Sentry test triggered. Check Sentry dashboard within 60s.",
  );
}
