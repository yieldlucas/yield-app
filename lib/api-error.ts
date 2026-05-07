// Gestion d'erreurs uniformisée pour les route handlers Next.js.
//
// Pattern :
//   try {
//     if (!auth) throw unauthorized();
//     ...
//   } catch (err) {
//     return apiErrorResponse(err, "scope/route");
//   }
//
// Garanties :
//  - ApiError (4xx) : status + code + message public renvoyés tels quels au client.
//  - Erreur inconnue (5xx) : message générique, vraie erreur loggée via logger.
//  - Aucune PII / stack trace ne fuite dans la réponse HTTP.

import { NextResponse } from "next/server";
import { logger } from "./logger";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly publicMessage: string;
  readonly context?: Record<string, unknown>;

  constructor(opts: {
    status: number;
    code: string;
    publicMessage: string;
    cause?: unknown;
    context?: Record<string, unknown>;
  }) {
    super(opts.publicMessage);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.publicMessage = opts.publicMessage;
    this.context = opts.context;
    if (opts.cause !== undefined) {
      (this as unknown as { cause: unknown }).cause = opts.cause;
    }
  }
}

export const unauthorized = (message = "Non authentifié") =>
  new ApiError({ status: 401, code: "UNAUTHORIZED", publicMessage: message });

export const forbidden = (message = "Accès refusé") =>
  new ApiError({ status: 403, code: "FORBIDDEN", publicMessage: message });

export const notFound = (message = "Ressource introuvable") =>
  new ApiError({ status: 404, code: "NOT_FOUND", publicMessage: message });

export const badRequest = (message: string, code = "BAD_REQUEST") =>
  new ApiError({ status: 400, code, publicMessage: message });

export const conflict = (message: string, code = "CONFLICT", context?: Record<string, unknown>) =>
  new ApiError({ status: 409, code, publicMessage: message, context });

export const paymentRequired = (
  message: string,
  code = "PAYMENT_REQUIRED",
  context?: Record<string, unknown>,
) => new ApiError({ status: 402, code, publicMessage: message, context });

/**
 * 429 Too Many Requests. Le `retry_after_seconds` est inclus dans le body de
 * la réponse (sous ce nom) — pas dans le header `Retry-After` standard, parce
 * que notre client SPA lit le JSON en priorité. Ajouter le header en plus si
 * un client externe en a besoin.
 */
export const tooManyRequests = (
  message: string,
  retryAfterSeconds?: number,
  code = "RATE_LIMITED",
) => new ApiError({
  status: 429,
  code,
  publicMessage: message,
  context: retryAfterSeconds != null ? { retry_after_seconds: retryAfterSeconds } : undefined,
});

export const internal = (message = "Erreur interne", cause?: unknown) =>
  new ApiError({ status: 500, code: "INTERNAL_ERROR", publicMessage: message, cause });

/**
 * Convertit une erreur en NextResponse JSON standardisée.
 * À appeler dans le `catch` final de chaque route handler.
 *
 * @param err l'erreur capturée (ApiError ou autre)
 * @param scope identifiant court de la route, pour les logs (ex: "invoices/process")
 */
export function apiErrorResponse(err: unknown, scope: string): NextResponse {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      logger.error(scope, err.publicMessage, {
        code: err.code,
        cause: (err as unknown as { cause?: unknown }).cause,
        context: err.context,
      });
    } else {
      logger.warn(scope, err.publicMessage, { code: err.code, context: err.context });
    }
    return NextResponse.json(
      { error: err.publicMessage, code: err.code, ...(err.context ?? {}) },
      { status: err.status },
    );
  }
  logger.error(scope, "Erreur non gérée", { error: err });
  return NextResponse.json(
    {
      error: "Une erreur interne est survenue. Réessayez ou contactez le support.",
      code: "INTERNAL_ERROR",
    },
    { status: 500 },
  );
}
