// Helpers pour les features de rétention "Membre fondateur".
// Lit profiles.founder_number / founder_letter_seen_at / referral_code /
// referred_by_code via la RLS standard (owner_profiles).

import { supabase } from "@/lib/supabase-browser";

export type FounderInfo = {
  founderNumber: number | null;
  founderLetterSeenAt: string | null;
  referralCode: string | null;
  referredByCode: string | null;
  createdAt: string | null;
};

/** Lit les infos fondateur du user courant. NULL partout si compte pré-migration
 *  016 et que le backfill n'a pas encore tourné. */
export async function fetchFounderInfo(): Promise<FounderInfo | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("founder_number, founder_letter_seen_at, referral_code, referred_by_code, created_at")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    founder_number: number | null;
    founder_letter_seen_at: string | null;
    referral_code: string | null;
    referred_by_code: string | null;
    created_at: string | null;
  };
  return {
    founderNumber: row.founder_number,
    founderLetterSeenAt: row.founder_letter_seen_at,
    referralCode: row.referral_code,
    referredByCode: row.referred_by_code,
    createdAt: row.created_at,
  };
}

/** Marque la lettre du fondateur comme vue. Idempotent — peut être appelé
 *  plusieurs fois sans effet de bord. Stocke un timestamp pour traçabilité. */
export async function markFounderLetterSeen(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { error } = await supabase
    .from("profiles")
    .update({ founder_letter_seen_at: new Date().toISOString() })
    .eq("id", session.user.id);
  return !error;
}

/** Compte le nombre de chefs qui se sont inscrits avec un referral_code donné.
 *  Utilisé dans le profil : "X chefs ont rejoint Yield grâce à toi". */
export async function fetchReferralCount(referralCode: string): Promise<number> {
  if (!referralCode) return 0;
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by_code", referralCode);
  if (error) return 0;
  return count ?? 0;
}

/** Applique le code parrain au profile (appelé au moment de l'onboarding,
 *  une fois que le user a saisi le nom de son restaurant et qu'on a un id
 *  stable). Idempotent — ne ré-écrit pas si déjà un code stocké. */
export async function applyReferralCode(code: string): Promise<boolean> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return false;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  // Vérifier d'abord que le code existe (sinon on stocke un code orphelin)
  // et qu'il n'est pas le code de l'user lui-même.
  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("referral_code, referred_by_code")
    .eq("id", session.user.id)
    .maybeSingle();
  const own = ownProfile as { referral_code: string | null; referred_by_code: string | null } | null;
  if (!own) return false;
  if (own.referred_by_code) return true; // Déjà appliqué, ne touche pas
  if (own.referral_code === trimmed) return false; // Auto-parrainage interdit

  const { data: refExists } = await supabase
    .from("profiles")
    .select("id")
    .eq("referral_code", trimmed)
    .maybeSingle();
  if (!refExists) return false;

  const { error } = await supabase
    .from("profiles")
    .update({ referred_by_code: trimmed })
    .eq("id", session.user.id);
  return !error;
}

/** Aggrégats pour le bloc "Votre histoire avec Yield" sur la page profil.
 *  Plusieurs counts via head:true (rapide, no rows). Total estimated savings
 *  intentionnellement omis pour cette v1 : trop facile à mal calculer et
 *  un chiffre faux discrédite tout le reste. */
export type YourHistory = {
  invoicesCount: number;
  alertsCount: number;
  recipesCount: number;
  productsTracked: number;
};

export async function fetchYourHistory(): Promise<YourHistory> {
  const [inv, alerts, recipes, products] = await Promise.all([
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "processed"),
    supabase.from("margin_alerts").select("id", { count: "exact", head: true }),
    supabase.from("recipes").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }),
  ]);
  return {
    invoicesCount: inv.count ?? 0,
    alertsCount: alerts.count ?? 0,
    recipesCount: recipes.count ?? 0,
    productsTracked: products.count ?? 0,
  };
}
