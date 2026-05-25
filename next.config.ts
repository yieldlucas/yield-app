import type { NextConfig } from "next";
// Fix audit I4 — wrap export avec withSentryConfig pour activer le tracking
// d'erreurs côté serveur/client/edge runtime Next.js. SDK no-op si SENTRY_DSN
// n'est pas configuré (cf sentry.*.config.ts pour le graceful fallback).
import { withSentryConfig } from "@sentry/nextjs";

// Headers de sécurité appliqués à toutes les routes. Set conservateur :
//   - PAS de Content-Security-Policy ici (une CSP stricte mal réglée casse
//     Stripe Checkout / Supabase / Sentry / styles inline — à introduire après
//     un vrai passage de test dédié).
//   - Permissions-Policy autorise la caméra en self (scan des BL), bloque le
//     reste. Le file-input `capture` n'en dépend pas, mais on protège l'avenir.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Build strict : toute regression TS ou ESLint qui passerait la review locale
  // fait échouer le déploiement Vercel. Filet de sécurité final avant prod.
  // Pour ne PAS bloquer un hotfix urgent, on peut temporairement repasser à
  // `ignoreBuildErrors: true` puis fixer après.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

// Fix audit I4 — options Sentry pour le build (set conservateur V1) :
//   - silent: true → masque les logs Sentry pendant le build (sinon Vercel
//     log spammé à chaque déploiement)
//   - org/project optionnels lus depuis env (vides en dev → upload skip)
//   - authToken OPTIONNEL en V1 : sans, les sourcemaps ne sont pas uploadées
//     et les stack traces remontent minifiées (toujours lisibles avec un peu
//     d'effort). À ajouter quand on aura besoin de stack traces propres pour
//     debug. Voir docs/deployment-notes.md.
//
// Options non utilisées en V1 (API @sentry/nextjs v10 si on veut les activer
// plus tard) : sourcemaps.disable, disableLogger, widenClientFileUpload, etc.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
