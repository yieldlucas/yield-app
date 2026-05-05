// Helpers d'authentification côté route handlers.
//
// Deux formes d'auth selon le contexte :
//
// 1. Bearer JWT (`Authorization: Bearer <token>`) — la norme pour le client SPA
//    qui appelle l'API en fetch. Le token vient de supabase.auth.getSession().
//    Validé via supabase.auth.getUser, retourne l'user id et un client RLS-safe.
//
// 2. Token signé HMAC court-terme via `?t=<token>` — uniquement pour les routes
//    d'export (PDF/CSV) ouvertes via window.open. Le navigateur ne peut pas
//    attacher un header sur un download direct, donc on utilise un proxy
//    éphémère (5 min, scopé à la ressource).
//
// IMPORTANT : la 2e voie ne peut être empruntée que par les endpoints d'export
// qui ont accepté de l'utiliser explicitement (via authorizeExport).

import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unauthorized } from "./api-error";
import { verifyExportToken } from "./export-token";

/**
 * Auth standard via Bearer JWT. Retourne `{ userId, supabase }` où `supabase`
 * est un client lié au token user (donc soumis aux RLS de cet user — ce qui est
 * ce qu'on veut pour la majorité des routes API).
 *
 * Throw `unauthorized()` si pas de Bearer ou token invalide.
 */
export async function authorizeBearer(req: NextRequest): Promise<{
  userId: string;
  email: string | null;
  supabase: SupabaseClient;
  accessToken: string;
}> {
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) throw unauthorized();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) throw unauthorized("Session expirée");

  return { userId: user.id, email: user.email ?? null, supabase, accessToken };
}

/**
 * Auth pour les routes d'export (PDF/CSV download).
 * Accepte soit un Bearer JWT, soit un `?t=<signed_token>` scopé.
 *
 * @param expectedSub ressource attendue (invoiceId pour endpoints scopés, null pour export global)
 * @returns userId du caller
 */
export async function authorizeExport(
  req: NextRequest,
  expectedSub: string | null,
): Promise<string> {
  // Voie 1 : Bearer header (curl, dev, admin)
  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (accessToken) {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: { user }, error } = await sb.auth.getUser(accessToken);
    if (error || !user) throw unauthorized("Session expirée");
    return user.id;
  }

  // Voie 2 : signed token via query string (navigateur)
  const signed = req.nextUrl.searchParams.get("t");
  if (!signed) throw unauthorized();
  const payload = verifyExportToken(signed, expectedSub);
  if (!payload) throw unauthorized("Lien d'export expiré ou invalide");
  return payload.uid;
}
