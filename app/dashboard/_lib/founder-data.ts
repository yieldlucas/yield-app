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
  /** Jours d'essai bonus accumulés via parrainage (RPC apply_referral_code).
   *  > 0 = l'user est en "essai parrainé Starter Pro" : on doit masquer
   *  l'offre 14j et afficher son statut spécial. */
  trialExtraDays: number;
};

/** Lit les infos fondateur du user courant. NULL partout si compte pré-migration
 *  016 et que le backfill n'a pas encore tourné. */
export async function fetchFounderInfo(): Promise<FounderInfo | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("founder_number, founder_letter_seen_at, referral_code, referred_by_code, created_at, trial_extra_days")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    founder_number: number | null;
    founder_letter_seen_at: string | null;
    referral_code: string | null;
    referred_by_code: string | null;
    created_at: string | null;
    trial_extra_days: number | null;
  };
  return {
    founderNumber: row.founder_number,
    founderLetterSeenAt: row.founder_letter_seen_at,
    referralCode: row.referral_code,
    referredByCode: row.referred_by_code,
    createdAt: row.created_at,
    trialExtraDays: Math.max(0, Number(row.trial_extra_days) || 0),
  };
}

/** Constante miroir de TRIAL_DAYS dans /api/invoices/process.
 *  Doit rester en sync — utilisée pour calculer les jours restants côté UI. */
export const TRIAL_DAYS_DEFAULT = 14;

/** Calcule les jours d'essai restants pour un user non-abonné.
 *  Formule alignée avec le trial gate côté API :
 *  effectiveTrialDays = MAX(14, trial_extra_days). Retourne 0 si trial expiré. */
export function computeTrialDaysLeft(createdAt: string | null, trialExtraDays: number): {
  totalDays: number;
  daysLeft: number;
  isReferred: boolean;
} {
  const total = Math.max(TRIAL_DAYS_DEFAULT, trialExtraDays);
  const isReferred = trialExtraDays > 0;
  if (!createdAt) return { totalDays: total, daysLeft: total, isReferred };
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const left = Math.max(0, Math.ceil(total - elapsed));
  return { totalDays: total, daysLeft: left, isReferred };
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

/** Self-heal : déclenche l'assignation founder_number + referral_code pour
 *  l'user courant s'il n'en a pas encore (cas webhook auth/user-created
 *  raté ou migration en retard). Idempotent côté Postgres — safe à appeler
 *  à chaque mount du dashboard si on détecte un état vide.
 *
 *  Renvoie true si l'appel a réussi (heal tenté), false sinon. Le caller
 *  doit refetch fetchFounderInfo() après pour récupérer les nouvelles valeurs. */
export async function ensureFounderMetadata(): Promise<boolean> {
  const { error } = await supabase.rpc("ensure_founder_metadata");
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

export type ApplyReferralResult =
  | { ok: true; daysCredited: number; alreadyApplied?: false }
  | { ok: true; alreadyApplied: true; daysCredited?: undefined }
  | { ok: false; error: "invalid_code" | "self_referral" | "duplicate_account" | "already_subscribed" | "rpc_missing" | "not_authenticated" | "unknown" };

/** Applique un code parrain via la RPC sécurisée (migration 017).
 *
 *  Toute la logique critique vit dans Postgres avec security definer :
 *  validation, anti-fraude (normalized_email), anti-auto-parrainage, race
 *  condition guard. Le client ne fait que déclencher et afficher le résultat.
 *
 *  Renvoie un objet structuré : succès avec days_credited, ou erreur typée. */
export async function applyReferralCode(code: string): Promise<ApplyReferralResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: "invalid_code" };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase.rpc("apply_referral_code", { p_code: trimmed });
  if (error) {
    // PostgREST code PGRST202 = "function does not exist" → migration 017/018
    // pas appliquée sur Supabase. Distinct de "unknown" pour un message clair
    // côté UI (et debug plus rapide pour Lucas).
    const code = (error as { code?: string }).code;
    if (code === "PGRST202") {
      return { ok: false, error: "rpc_missing" };
    }
    return { ok: false, error: "unknown" };
  }
  const result = data as {
    ok?: boolean;
    error?: string;
    days_credited?: number;
    already_applied?: boolean;
  } | null;
  if (!result) return { ok: false, error: "unknown" };
  if (result.ok === false) {
    const validErrors = ["invalid_code", "self_referral", "duplicate_account", "already_subscribed", "rpc_missing", "not_authenticated"] as const;
    type ErrCode = (typeof validErrors)[number];
    const errCode = result.error && (validErrors as readonly string[]).includes(result.error)
      ? (result.error as ErrCode)
      : "unknown";
    return { ok: false, error: errCode };
  }
  if (result.already_applied) {
    return { ok: true, alreadyApplied: true };
  }
  return { ok: true, daysCredited: result.days_credited ?? 0 };
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
