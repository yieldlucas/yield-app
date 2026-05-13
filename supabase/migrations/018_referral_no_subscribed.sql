-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 018 — Sécurité parrainage : refuser si caller est déjà abonné
--
-- Faille business identifiée : avec la version actuelle de apply_referral_code,
-- 2 abonnés peuvent se parrainer mutuellement et accumuler des trial_extra_days
-- latents (utiles s'ils résilient un jour) sans rien apporter de réel à Yield.
-- Boucle :
--   Marc (abonné) ⇄ Christophe (abonné) : chacun applique le code de l'autre,
--   +30j × ∞ paliers.
--
-- Règle métier : le code parrain donne des jours d'ESSAI supplémentaires. Un
-- user abonné n'est plus en essai → la récompense filleul n'a pas de sens
-- pour lui. On bloque l'application côté caller (le filleul potentiel).
--
-- Le parrain (propriétaire du code) peut être n'importe qui — abonné ou non.
-- Sa récompense reste +30j de trial_extra_days, latents s'il est abonné.
-- L'abus disparaît car le filleul DOIT être en trial pour appliquer.
-- ─────────────────────────────────────────────────────────────────────────────

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
  caller_subscribed boolean;
  parrain_id uuid;
  v_existing_twin uuid;
  v_normalized_code text;
  rows_affected int;
begin
  if caller_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_normalized_code := upper(btrim(p_code));
  if v_normalized_code is null or length(v_normalized_code) < 4 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  -- Lit le profile caller + son statut subscription en une requête.
  select referral_code, referred_by_code, normalized_email, created_at, is_subscribed
    into caller_referral_code, caller_referred_by, caller_normalized,
         caller_created_at, caller_subscribed
  from public.profiles
  where id = caller_id;

  -- ⚠ NOUVEAU GARDE-FOU : un user déjà abonné ne peut PAS appliquer un code
  -- parrain. Évite la boucle abusive abonné ⇄ abonné qui produisait des
  -- jours latents infinis pour les deux côtés.
  if caller_subscribed is true then
    return jsonb_build_object('ok', false, 'error', 'already_subscribed');
  end if;

  if caller_referred_by is not null then
    return jsonb_build_object('ok', true, 'already_applied', true);
  end if;

  if caller_referral_code = v_normalized_code then
    return jsonb_build_object('ok', false, 'error', 'self_referral');
  end if;

  select id into parrain_id
  from public.profiles
  where referral_code = v_normalized_code
  limit 1;

  if parrain_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  -- Anti-fraude email normalisé (cas Gmail +alias).
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

  -- Atomic update filleul + crédit parrain (le parrain peut être abonné ou
  -- non — son +30j devient latent s'il est abonné, utile s'il résilie un jour).
  update public.profiles
  set referred_by_code = v_normalized_code,
      trial_extra_days = trial_extra_days + 30
  where id = caller_id
    and referred_by_code is null;

  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    return jsonb_build_object('ok', true, 'already_applied', true);
  end if;

  update public.profiles
  set trial_extra_days = trial_extra_days + 30
  where id = parrain_id;

  return jsonb_build_object('ok', true, 'days_credited', 30);
end;
$$;

-- Grant inchangé (la fonction reste accessible aux authenticated users,
-- c'est la logique interne qui refuse les abonnés).
grant execute on function public.apply_referral_code(text) to authenticated;
