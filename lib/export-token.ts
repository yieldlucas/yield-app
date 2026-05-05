// Token court-terme HMAC pour les exports téléchargés depuis le navigateur.
//
// Pourquoi pas le JWT Supabase en query string : un access_token a une TTL
// d'~1h, donne accès à TOUTE l'API au nom de l'user, et apparaît dans les logs
// serveur, l'history navigateur, le referrer. Token compromis = compte compromis.
//
// Ici : token signé HMAC-SHA256 avec EXPORT_TOKEN_SECRET, TTL 5 min, scopé à
// {user_id, resource_id}. Compromis = un seul export.

import { createHmac, timingSafeEqual } from "crypto";

/** TTL par défaut. Garder très court : un download se fait en quelques secondes. */
const DEFAULT_TTL_SECONDS = 5 * 60;

type Payload = {
  /** Supabase auth user id. */
  uid: string;
  /** Resource subject (ex: invoiceId pour PDF). null = export global au compte. */
  sub: string | null;
  /** Expiration unix seconds. */
  exp: number;
};

function getSecret(): string {
  const secret = process.env.EXPORT_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("EXPORT_TOKEN_SECRET manquant ou trop court (min 32 chars)");
  }
  return secret;
}

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/**
 * Signe un payload pour usage dans `?t=` sur les routes d'export.
 * @param uid user id du caller (depuis `supabase.auth.getUser`)
 * @param sub ressource ciblée (invoiceId pour PDF/CSV par facture, null pour export global)
 * @param ttlSec durée de vie en secondes, défaut 5 min
 */
export function signExportToken(
  uid: string,
  sub: string | null,
  ttlSec: number = DEFAULT_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload: Payload = { uid, sub, exp };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = b64urlEncode(createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

/**
 * Vérifie un token signé. Retourne le payload si valide, null sinon.
 * Aucune information sur la cause d'échec n'est leakée — c'est volontaire.
 *
 * @param token la valeur de `?t=` reçue côté route handler
 * @param expectedSub si fourni, exige que le token soit scopé sur cette ressource
 */
export function verifyExportToken(token: string, expectedSub?: string | null): Payload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  // 1) signature
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  let provided: Buffer;
  try {
    provided = b64urlDecode(sig);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  // 2) payload
  let payload: Payload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8")) as Payload;
  } catch {
    return null;
  }
  if (typeof payload?.uid !== "string") return null;
  if (typeof payload?.exp !== "number") return null;
  // sub peut être null ou string, mais doit être présent
  if (payload.sub !== null && typeof payload.sub !== "string") return null;

  // 3) expiration
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  // 4) scope (si demandé)
  if (expectedSub !== undefined && payload.sub !== expectedSub) return null;

  return payload;
}
