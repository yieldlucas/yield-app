-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022 — Lockdown RLS profiles (audit cybersec)
--
-- Failles identifiées :
--
--   1. La table `profiles` n'a jamais été codifiée avec `enable row level
--      security` ni `create policy ... for select` par migration. Si la RLS
--      est actuellement active sur l'instance prod, c'est uniquement parce
--      que Lucas l'a activée à la main dans Supabase Studio. Pas garanti en
--      cas de restore depuis backup ou de re-provisionnement.
--
--   2. La policy UPDATE de migration 002 n'a PAS de clause `with check` :
--          create policy "Users update own profile" on public.profiles
--            for update using (auth.uid() = id);
--      → un user peut UPDATE son email à n'importe quelle valeur. Risque :
--      spoofing du destinataire des mails (monthly-recap, trial-reminder),
--      car l'app envoie sur profiles.email plutôt que auth.users.email.
--
--   3. Le trigger anti-tampering (migration 021) ne protège pas la colonne
--      `email`. Aucun cas légitime où l'user doit pouvoir réécrire son email
--      en DB directement — la source de vérité c'est auth.users.email, qui
--      doit passer par le flow OTP de Supabase Auth pour changer.
--
-- Fix : 1 migration qui (a) force RLS, (b) ajoute SELECT + UPDATE policies
-- avec `with check`, (c) étend le trigger anti-tampering à `email`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── (a) Force RLS profiles ──────────────────────────────────────────────────
-- Idempotent : si déjà activée, no-op. Si quelqu'un la désactive dans Studio,
-- l'application de la migration la réactive.
alter table public.profiles enable row level security;

-- ─── (b1) SELECT policy : un user ne voit QUE sa propre ligne ───────────────
-- Codifie explicitement le comportement attendu. service_role bypasse les RLS
-- automatiquement (webhooks, crons), pas besoin de policy supplémentaire.
drop policy if exists "owner_profiles" on public.profiles;
drop policy if exists "Users select own profile" on public.profiles;
create policy "Users select own profile" on public.profiles
  for select using (auth.uid() = id);

-- ─── (b2) UPDATE policy avec WITH CHECK ─────────────────────────────────────
-- Sans `with check`, l'UPDATE pouvait théoriquement glisser `id` vers une
-- autre valeur. `using` filtre quelles lignes je peux toucher, `with check`
-- filtre l'état final accepté. Les deux doivent matcher pour fermer la porte.
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── (c) Verrouille la colonne email dans le trigger anti-tampering ─────────
-- Réécriture complète du trigger (cumule migrations 003 + 021 + l'ajout email).
-- Cohérence avec la doc : la source de vérité c'est auth.users.email, qui se
-- modifie via supabase.auth.updateUser() côté client (re-OTP demandé par
-- Supabase). profiles.email n'est qu'un cache sync au signup.

create or replace function public.prevent_subscription_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bypass text;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  begin
    v_bypass := current_setting('app.allow_profile_tamper', true);
  exception when others then
    v_bypass := null;
  end;
  if v_bypass = 'true' then
    return new;
  end if;

  if new.is_subscribed is distinct from old.is_subscribed then
    raise exception 'is_subscribed can only be modified by service role'
      using errcode = '42501';
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'stripe_customer_id can only be modified by service role'
      using errcode = '42501';
  end if;
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
  if new.normalized_email is distinct from old.normalized_email then
    raise exception 'normalized_email is computed automatically'
      using errcode = '42501';
  end if;

  -- ⭐ Nouveau : email verrouillé. La source de vérité c'est auth.users.email.
  -- Toute synchronisation se fait via le webhook auth/user-created (en
  -- service_role) ou un trigger côté auth schema. Le client ne touche jamais.
  if new.email is distinct from old.email then
    raise exception 'email can only be modified by service role (sync auth.users)'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_subscription_tampering on public.profiles;
create trigger trg_prevent_subscription_tampering
  before update on public.profiles
  for each row execute function public.prevent_subscription_tampering();
