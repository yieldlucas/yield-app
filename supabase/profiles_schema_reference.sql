-- ─────────────────────────────────────────────────────────────────────────────
-- RÉFÉRENCE (pas une migration) — schéma de la table `profiles` + trigger signup
--
-- ⚠️ Ce fichier est volontairement HORS de supabase/migrations/ : il ne sera
--    PAS appliqué par `supabase db push`. C'est de la documentation de reprise.
--
-- POURQUOI : la table `public.profiles` et le trigger de création de profil au
-- signup ont été créés À LA MAIN dans Supabase Studio (cf commentaire de la
-- migration 022 : « La table profiles n'a jamais été codifiée... la RLS est
-- active uniquement parce que Lucas l'a activée à la main »). Ils ne sont donc
-- dans AUCUNE migration. Conséquences :
--
--   1. Sur la prod actuelle : tout fonctionne (les objets existent).
--   2. Sur une base VIERGE (restore, nouveau projet Supabase) : `db push`
--      casserait dès la migration 004 (elle fait `alter table profiles ...`
--      alors que la table n'existe pas encore).
--
-- POUR UNE VRAIE REPRODUCTIBILITÉ : fondre le bloc ci-dessous au DÉBUT de
-- supabase/migrations/001_initial_schema.sql (avant toute autre table qui
-- référence profiles). Ne PAS le mettre dans une migration tardive : l'ordre
-- d'exécution casserait quand même.
--
-- Ce fichier reconstitue l'état attendu à partir de l'inspection des migrations
-- 004 / 005 / 016 / 020 / 021 / 022 / 027. Vérifier contre la prod réelle
-- (Supabase Studio → Table editor → profiles) avant de s'en servir en recovery.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table profiles ───────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,
  email                     text,
  restaurant_name           text,
  is_subscribed             boolean not null default false,
  stripe_customer_id        text,
  -- Anti-fraude trial (migration 004) — calculée par trigger set_normalized_email.
  normalized_email          text,
  -- Rétention / parrainage (migration 016/017).
  trial_extra_days          integer not null default 0,
  founder_number            integer,
  founder_letter_seen_at    timestamptz,
  referral_code             text unique,
  referred_by_code          text,
  -- Idempotency crons (migration 020).
  trial_reminder_sent_at    timestamptz,
  last_monthly_recap_sent_at timestamptz,
  -- Persistance onboarding (migration 027).
  onboarding_seen_at        timestamptz,
  first_scan_celebrated_at  timestamptz,
  created_at                timestamptz not null default now()
);

-- Filet idempotent si la table existe déjà mais qu'il manque une colonne.
alter table public.profiles
  add column if not exists email text,
  add column if not exists restaurant_name text,
  add column if not exists is_subscribed boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists normalized_email text,
  add column if not exists trial_extra_days integer not null default 0,
  add column if not exists founder_number integer,
  add column if not exists founder_letter_seen_at timestamptz,
  add column if not exists referral_code text,
  add column if not exists referred_by_code text,
  add column if not exists trial_reminder_sent_at timestamptz,
  add column if not exists last_monthly_recap_sent_at timestamptz,
  add column if not exists onboarding_seen_at timestamptz,
  add column if not exists first_scan_celebrated_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

-- NB : l'activation RLS + les policies select/update (migration 022), le trigger
-- anti-tampering (021/022) et le trigger set_normalized_email (004) restent
-- définis dans leurs migrations respectives — ils s'appliqueront dès lors que
-- profiles existe avant elles.

-- ── Trigger de création de profil au signup ──────────────────────────────────
-- C'est LE maillon manquant : sans lui, un nouvel inscrit n'a pas de ligne
-- profiles → created_at NULL → le trial gate de /api/invoices/process refuse
-- le scan dès J1 (« essai expiré »). Convention Supabase : on_auth_user_created.
--
-- Le DO-block ne (re)crée le trigger QUE s'il est absent → no-op total sur la
-- prod actuelle (où il existe déjà), création propre sur une base vierge.

do $do$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created'
      and not tgisinternal
  ) then
    execute $func$
      create or replace function public.handle_new_user()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        insert into public.profiles (id, email, created_at)
        values (new.id, new.email, now())
        on conflict (id) do nothing;
        return new;
      end;
      $body$;
    $func$;

    execute $func$
      create trigger on_auth_user_created
        after insert on auth.users
        for each row execute function public.handle_new_user();
    $func$;
  end if;
end
$do$;
