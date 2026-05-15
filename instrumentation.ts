// Fix audit I4 — Hook d'instrumentation Next.js 15 qui charge la config Sentry
// adaptée au runtime (nodejs serverless OU edge). Doit se trouver à la racine
// du projet ; Next.js le détecte automatiquement.
//
// Voir https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// onRequestError est appelé par Next.js sur les erreurs server-side non
// catchées (server components, server actions). On délègue à Sentry pour
// que ces erreurs soient capturées sans avoir à wrapper chaque route.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
