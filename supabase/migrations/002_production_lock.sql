-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — Production lock
-- 1. Idempotency Stripe webhook (table processed_events)
-- 2. RLS Storage sur le bucket "invoices"
-- 3. Policies UPDATE manquantes sur profiles
-- ─────────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────
-- 1. Idempotency Stripe webhook
-- ──────────────────────────────────────────────────────────
create table if not exists public.processed_events (
  id text primary key,
  created_at timestamp with time zone default now()
);

create index if not exists processed_events_created_at_idx
  on public.processed_events(created_at);

alter table public.processed_events enable row level security;
-- Aucune policy → seul la service role peut écrire (le webhook).
-- Anon et authenticated sont bloqués totalement.

-- Optionnel : nettoyage automatique des events de +30 jours (Stripe ne retente
-- que pendant 3 jours, donc 30j est large). À schedule via pg_cron si activé,
-- ou à exécuter manuellement de temps en temps.
-- delete from public.processed_events where created_at < now() - interval '30 days';


-- ──────────────────────────────────────────────────────────
-- 2. RLS Storage sur le bucket "invoices"
-- ──────────────────────────────────────────────────────────
-- IMPORTANT : avant d'appliquer ces policies, vérifier dans
-- Supabase Studio → Storage → bucket "invoices" que "Public bucket" est OFF.
--
-- Schéma de path attendu : invoices/{restaurant_id}/{timestamp}-{filename}
-- → storage.foldername(name)[1] = restaurant_id

drop policy if exists "Users read own restaurant files" on storage.objects;
create policy "Users read own restaurant files" on storage.objects
  for select using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "Users upload to own restaurant" on storage.objects;
create policy "Users upload to own restaurant" on storage.objects
  for insert with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "Users update own restaurant files" on storage.objects;
create policy "Users update own restaurant files" on storage.objects
  for update using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

drop policy if exists "Users delete own restaurant files" on storage.objects;
create policy "Users delete own restaurant files" on storage.objects
  for delete using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );


-- ──────────────────────────────────────────────────────────
-- 3. Profiles : UPDATE policy (manquante pour la page profile)
-- ──────────────────────────────────────────────────────────
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Et la colonne restaurant_name (utilisée par la page profile)
alter table public.profiles
  add column if not exists restaurant_name text;
