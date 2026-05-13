-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 021 — Durcissement anti-tampering critique
--
-- Faille trouvée au check-up : le trigger prevent_subscription_tampering
-- (migration 003) protégeait UNIQUEMENT `is_subscribed` et `stripe_customer_id`.
-- Les colonnes ajoutées en migrations 016/017 n'étaient PAS protégées :
--
--   - trial_extra_days : un user authentifié pouvait faire en DevTools
--     `supabase.from('profiles').update({trial_extra_days: 9999})` → 9999
--     jours d'essai gratuit. Bypass complet du système de parrainage et du
--     trial gate côté serveur.
--
--   - referral_code : pouvait être réécrit pour squatter un code "vanity"
--     (ex: "GOAT-0001") qui n'aurait pas été généré par notre algo.
--
--   - referred_by_code : pouvait être set arbitrairement, bypass total de
--     la logique anti-fraude de la RPC apply_referral_code (anti-auto-
--     parrainage, anti-fraude email normalisé, anti-déjà-abonné).
--
--   - founder_number : cosmétique mais pouvait être réécrit pour faker
--     "Membre fondateur #1".
--
--   - normalized_email : calculé par trigger (migration 004), ne doit jamais
--     être touché manuellement (sinon contournement de l'anti-fraude trial).
--
-- ─── Subtilité ────────────────────────────────────────────────────────────────
-- Les RPCs apply_referral_code / assign_founder_metadata sont SECURITY DEFINER
-- mais `auth.role()` reste 'authenticated' à l'intérieur (parce qu'il lit le
-- JWT, pas l'owner Postgres). Sans mécanisme de bypass, le nouveau trigger
-- bloquerait ces RPCs légitimes.
--
-- Solution : GUC transactionnel `app.allow_profile_tamper`. Les RPCs trusted
-- le set à 'true' avant leur UPDATE privilégié. Le trigger respecte ce flag.
-- Sécurité : le GUC est transaction-scoped (set_config(_, _, true)), donc
-- ne fuit jamais entre 2 requêtes. Un user ne peut pas le set lui-même
-- depuis PostgREST (il faudrait une RPC dédiée qu'on n'expose pas).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Trigger renforcé ───────────────────────────────────────────────────────
create or replace function public.prevent_subscription_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bypass text;
begin
  -- service_role bypasse tout (webhooks Stripe, migrations admin).
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Bypass via GUC transactionnel pour les RPCs trusted (apply_referral_code,
  -- assign_founder_metadata). Évalué AVANT les vérifications colonne par
  -- colonne pour court-circuiter rapidement.
  begin
    v_bypass := current_setting('app.allow_profile_tamper', true);
  exception when others then
    v_bypass := null;
  end;
  if v_bypass = 'true' then
    return new;
  end if;

  -- ─── Abonnement (migration 003) ───
  if new.is_subscribed is distinct from old.is_subscribed then
    raise exception 'is_subscribed can only be modified by service role'
      using errcode = '42501';
  end if;

  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'stripe_customer_id can only be modified by service role'
      using errcode = '42501';
  end if;

  -- ─── Parrainage / essai (migrations 016+017) ───
  if new.trial_extra_days is distinct from old.trial_extra_days then
    raise exception 'trial_extra_days can only be modified by service role or trusted RPC'
      using errcode = '42501';
  end if;

  if new.referral_code is distinct from old.referral_code then
    raise exception 'referral_code can only be modified by service role or trusted RPC'
      using errcode = '42501';
  end if;

  if new.referred_by_code is distinct from old.referred_by_code then
    raise exception 'referred_by_code can only be modified by service role or trusted RPC'
      using errcode = '42501';
  end if;

  if new.founder_number is distinct from old.founder_number then
    raise exception 'founder_number can only be modified by service role or trusted RPC'
      using errcode = '42501';
  end if;

  -- normalized_email : calculé par trigger (migration 004) pour l'anti-fraude.
  if new.normalized_email is distinct from old.normalized_email then
    raise exception 'normalized_email is computed automatically'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Le trigger lui-même est inchangé (même nom, même table, même timing).
-- On le ré-attache pour s'assurer qu'il pointe sur la nouvelle version.
drop trigger if exists trg_prevent_subscription_tampering on public.profiles;
create trigger trg_prevent_subscription_tampering
  before update on public.profiles
  for each row execute function public.prevent_subscription_tampering();

comment on function public.prevent_subscription_tampering() is
  'Bloque les UPDATE clients sur les colonnes sensibles de profiles. Bypass via GUC app.allow_profile_tamper=true (transaction-scoped) pour les RPCs trusted. Migration 021.';

-- ─── RPC apply_referral_code : version trusted-aware ────────────────────────
-- Réécrite pour set le GUC bypass juste avant l'UPDATE privilégié. Aucune
-- autre logique métier ne change vs migration 018 — c'est purement plumbing.

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

  select referral_code, referred_by_code, normalized_email, created_at, is_subscribed
    into caller_referral_code, caller_referred_by, caller_normalized,
         caller_created_at, caller_subscribed
  from public.profiles
  where id = caller_id;

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

  -- Active le bypass anti-tampering UNIQUEMENT pour cette transaction.
  -- Le 3e paramètre `true` rend le set local à la transaction → impossible
  -- qu'il fuit vers une autre requête.
  perform set_config('app.allow_profile_tamper', 'true', true);

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

grant execute on function public.apply_referral_code(text) to authenticated;

-- ─── RPC assign_founder_metadata : version trusted-aware ────────────────────
-- Idem, set le bypass GUC avant les UPDATEs de founder_number + referral_code.

create or replace function public.assign_founder_metadata(p_user_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  next_number int;
  new_code text;
begin
  -- Active le bypass anti-tampering pour cette transaction.
  perform set_config('app.allow_profile_tamper', 'true', true);

  update public.profiles p
  set founder_number = coalesce(p.founder_number, (
    select count(*) + 1
    from public.profiles
    where created_at < p.created_at
  ))
  where id = p_user_id
    and p.founder_number is null
  returning founder_number into next_number;

  if exists (select 1 from public.profiles where id = p_user_id and referral_code is null) then
    for i in 1..10 loop
      new_code := public.generate_referral_code();
      begin
        update public.profiles
        set referral_code = new_code
        where id = p_user_id and referral_code is null;
        exit;
      exception when unique_violation then
        new_code := null;
      end;
    end loop;
  end if;
end;
$$;
