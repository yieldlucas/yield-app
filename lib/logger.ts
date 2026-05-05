// Logger applicatif unifié — usage: `import { logger } from "@/lib/logger"`.
//
// Objectif : tous les try/catch de l'app loggent au même endroit, dans un format
// stable, et passent par un scrub PII automatique avant écriture (Vercel logs
// peuvent être indexés, Sentry/Logflare aussi → on ne laisse JAMAIS de JWT,
// d'email ou d'UUID complet sortir d'ici).
//
// En prod Vercel, console.error/warn/log apparaissent dans les Function Logs
// du dashboard. Pas de service externe pour le MVP — ajouter ici plus tard.

type LogContext = Record<string, unknown>;

// Clés à blacklister entièrement dans les objets de contexte.
const PII_KEYS = new Set([
  "email",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "apikey",
  "api_key",
  "jwt",
  "secret",
  "stripe_secret",
  "service_role_key",
]);

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
// Tronque les UUID au préfixe (assez pour corréler en debug, pas assez pour ré-identifier).
const UUID_RE = /\b[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\b/gi;

function scrubString(s: string): string {
  return s
    .replace(EMAIL_RE, "[email]")
    .replace(JWT_RE, "[jwt]")
    .replace(UUID_RE, (m) => `${m.slice(0, 8)}…`);
}

function scrubValue(v: unknown, depth = 0): unknown {
  if (v == null) return v;
  if (depth > 4) return "[depth-limit]";
  if (typeof v === "string") return scrubString(v);
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Error) {
    return {
      name: v.name,
      message: scrubString(v.message),
      // 4 frames suffisent à localiser, ne polluent pas les logs.
      stack: v.stack ? scrubString(v.stack.split("\n").slice(0, 4).join("\n")) : undefined,
    };
  }
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => scrubValue(x, depth + 1));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = PII_KEYS.has(k.toLowerCase()) ? "[redacted]" : scrubValue(val, depth + 1);
    }
    return out;
  }
  return String(v);
}

function emit(level: "error" | "warn" | "info", scope: string, message: string, context?: LogContext): void {
  const safe = context ? scrubValue(context) : undefined;
  const line = `[${scope}] ${scrubString(message)}`;
  if (level === "error") console.error(line, safe ?? "");
  else if (level === "warn") console.warn(line, safe ?? "");
  else console.log(line, safe ?? "");
}

export const logger = {
  /** Erreur applicative : fail flow, à investiguer. Sentry-worthy. */
  error: (scope: string, message: string, context?: LogContext) => emit("error", scope, message, context),
  /** Warning : flow continue mais comportement inattendu (fallback, retry…). */
  warn: (scope: string, message: string, context?: LogContext) => emit("warn", scope, message, context),
  /** Info : événement notable, pas un problème. À utiliser avec parcimonie. */
  info: (scope: string, message: string, context?: LogContext) => emit("info", scope, message, context),
};
