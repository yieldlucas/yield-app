-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 017 — Récompense parrainage sécurisée
--
-- Implémente la vraie logique métier du système de parrainage :
--   - Le filleul gagne 30 jours d'essai supplémentaires automatiquement.
--   - Le parrain gagne 30 jours bonus (stockés, utilisables à la résiliation
--     ou applicables par Lucas via coupon Stripe pour les abonnés actifs).
--
-- TOUT passe par une RPC `apply_referral_code` avec `security definer` pour
-- éviter les manipulations client. La logique côté Next ne fait que déclencher
-- la RPC et afficher le résultat.
--
-- Anti-abuse intégrés :
--   1. Idempotence : un user ne peut être parrainé qu'une seule fois
--      (referred_by_code est NULL → set une fois, contrainte race-safe via
--      `WHERE referred_by_code IS NULL` dans le UPDATE).
--   2. Pas d'auto-parrainage : le code du parrain doit être ≠ du sien.
--   3. Validation : le code doit pointer sur un vrai profile existant.
--   4. Anti-fraude trial : si normalized_email existe déjà chez un autre
--      profile créé avant le filleul, on refuse (cas Gmail "foo+1@gmail").
--   5. Atomicité : tout dans une transaction, pas de fenêtre de race.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Colonne : crédit d'essai en jours ───────────────────────────────────────
-- Cumulable : chaque filleul ajoute 30 jours. Pour un user en trial,
-- s'additionne à TRIAL_DAYS=14 dans le gate. Pour un user abonné, c'est latent
-- (Lucas appliquera un coupon Stripe manuellement à la prochaine facture).

alter table public.profiles
  add column if not exists trial_extra_days int not null default 0;

comment on column public.profiles.trial_extra_days is
  'Jours d''essai bonus accumulés via parrainage. Ajouté à TRIAL_DAYS=14 dans le trial gate.';

-- ─── RPC : appliquer un code parrain ─────────────────────────────────────────
-- Retourne un JSON :
--   { ok: true, days_credited: 30 } → succès
--   { ok: true, already_applied: true } → déjà parrainé, no-op
--   { ok: false, error: "invalid_code" | "self_referral" | "duplicate_account" | "not_authenticated" }

create or replace function public.apply_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_referral_code text;
  caller_referred_by text;
  caller_normalized text;
  caller_created_at timestamptz;
  parrain_id uuid;
  v_existing_twin uuid;
  v_normalized_code text;
  rows_affected int;
begin
  if caller_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  -- Normalise le code (uppercase, trim).
  v_normalized_code := upper(btrim(p_code));
  if v_normalized_code is null or length(v_normalized_code) < 4 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  -- Lit le profile caller (1 seule requête).
  select referral_code, referred_by_code, normalized_email, created_at
    into caller_referral_code, caller_referred_by, caller_normalized, caller_created_at
  from public.profiles
  where id = caller_id;

  -- Déjà parrainé → no-op idempotent. Pas une erreur.
  if caller_referred_by is not null then
    return jsonb_build_object('ok', true, 'already_applied', true);
  end if;

  -- Auto-parrainage interdit.
  if caller_referral_code = v_normalized_code then
    return jsonb_build_object('ok', false, 'error', 'self_referral');
  end if;

  -- Code valide ?
  select id into parrain_id
  from public.profiles
  where referral_code = v_normalized_code
  limit 1;

  if parrain_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  -- Anti-fraude : un user qui a normalized_email = celui d'un compte plus ancien
  -- (cas Gmail "foo+1@gmail" pour multiplier les comptes) n'a pas droit au
  -- bonus parrainage. Réutilise la logique anti-fraude trial déjà en place.
  if caller_normalized is not null then
    select id into v_existing_twin
    from public.profiles
    where normalized_email = caller_normalized
      and id <> caller_id
      and created_at < caller_created_at
    limit 1;
    if v_existing_twin is not null then
      return jsonb_build_object('ok', false, 'error', 'duplicate_account');
    end if;
  end if;

  -- Atomic : applique le code + crédite le filleul. La clause
  -- WHERE referred_by_code IS NULL est notre race-condition guard : si 2
  -- appels concurrents arrivent, un seul écrit.
  update public.profiles
  set referred_by_code = v_normalized_code,
      trial_extra_days = trial_extra_days + 30
  where id = caller_id
    and referred_by_code is null;

  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    -- Concurrence : un autre call a appliqué entre temps. Idempotent.
    return jsonb_build_object('ok', true, 'already_applied', true);
  end if;

  -- Crédite aussi le parrain (+30 jours).
  update public.profiles
  set trial_extra_days = trial_extra_days + 30
  where id = parrain_id;

  return jsonb_build_object('ok', true, 'days_credited', 30);
end;
$$;

-- Le caller authentifié peut exécuter la RPC. security definer s'occupe du
-- reste (la fonction a accès complet aux profiles).
grant execute on function public.apply_referral_code(text) to authenticated;
