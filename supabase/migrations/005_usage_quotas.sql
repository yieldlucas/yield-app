-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — Usage stats & quotas mensuels
--
-- Objectif : protéger la marge unitaire en limitant les scans IA inclus dans
-- l'abonnement. À 0.027€/scan et 19.99€/mois, au-delà de ~600 scans on perd
-- de l'argent → quota lancement à 200, suffisant pour 95% des indépendants.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.usage_stats (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  year_month    text not null,                       -- 'YYYY-MM' UTC
  scan_count    integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (restaurant_id, year_month)
);

create index if not exists idx_usage_stats_restaurant
  on public.usage_stats(restaurant_id, year_month desc);

-- RLS : le propriétaire peut lire son propre compteur (pour l'afficher dans
-- le dashboard). L'écriture est réservée au service_role (edge function).
alter table public.usage_stats enable row level security;

drop policy if exists "owner_read_usage" on public.usage_stats;
create policy "owner_read_usage" on public.usage_stats
  for select using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

-- Pas de policy INSERT/UPDATE/DELETE → seul service_role passe.

-- Helper appelé par l'edge function après chaque scan réussi. Atomic upsert.
create or replace function public.increment_scan_usage(p_restaurant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_count integer;
begin
  insert into public.usage_stats (restaurant_id, year_month, scan_count, updated_at)
  values (p_restaurant_id, v_month, 1, now())
  on conflict (restaurant_id, year_month)
  do update set
    scan_count = usage_stats.scan_count + 1,
    updated_at = now()
  returning scan_count into v_count;
  return v_count;
end;
$$;
