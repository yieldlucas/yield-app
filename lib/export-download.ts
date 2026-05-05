// Helper côté navigateur pour déclencher un download d'export sécurisé.
//
// Flow :
//   1. POST /api/exports/sign avec Bearer JWT → reçoit un token HMAC court (5 min).
//   2. Ouvre l'URL `<path>?t=<token>` dans un nouvel onglet (download direct).
//
// Avant : on passait l'access_token Supabase en query string → JWT long terme
// dans les logs/history/referrer. Maintenant : token éphémère, scopé à la
// ressource, invalide après 5 min.

import { supabase } from "@/lib/supabase-browser";

type SignResponse = { token: string; expiresIn: number };

async function getSignedToken(sub: string | null): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Session expirée");
  }
  const res = await fetch("/api/exports/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ sub }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Signature export indisponible (${res.status})`);
  }
  const data = (await res.json()) as SignResponse;
  if (!data?.token) throw new Error("Réponse de signature invalide");
  return data.token;
}

/**
 * Ouvre l'URL d'export dans un nouvel onglet, avec un token signé en query.
 *
 * @param path chemin de l'API export (ex: `/api/invoices/${id}/export-pdf`)
 * @param sub ressource ciblée (invoiceId pour endpoints scopés, null pour export global)
 * @param extraQuery params additionnels (ex: `from`, `to` pour le CSV global)
 */
export async function openSignedExport(
  path: string,
  sub: string | null,
  extraQuery: Record<string, string> = {},
): Promise<void> {
  const token = await getSignedToken(sub);
  const params = new URLSearchParams({ t: token, ...extraQuery });
  window.open(`${path}?${params.toString()}`, "_blank");
}
