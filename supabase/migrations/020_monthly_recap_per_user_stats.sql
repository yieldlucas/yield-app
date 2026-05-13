-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020 — Fix critique : récap mensuel scopé par user
--
-- Avant : /api/cron/monthly-recap récupérait la "plus grosse hausse de prix
-- du mois" et le "nombre d'alertes" via 3 queries séparées qui NE FILTRAIENT
-- PAS par restaurant_id (service role bypass RLS). Chaque chef recevait un
-- mail avec des stats globales de toute la base → données fausses + fuite
-- indirecte de l'activité totale du système.
--
-- Fix : on étend monthly_recap_candidates pour inclure DIRECTEMENT (côté SQL,
-- scopé au user_id de la ligne) :
--   - alerts_count_period
--   - top_rise_product
--   - top_rise_pct
--   - recipes_total
-- Tout dans une seule fonction → 1 RPC call, 0 risque de mauvais scoping
-- côté Node, et l'optimiseur Postgres regroupe proprement.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.monthly_recap_candidates(timestamptz, timestamptz, int);

create or replace function public.monthly_recap_candidates(
  p_month_start timestamptz,
  p_month_end timestamptz,
  p_min_scans int default 5
)
returns table (
  user_id uuid,
  email text,
  restaurant_name text,
  invoices_count bigint,
  alerts_count_period bigint,
  recipes_total bigint,
  top_rise_product text,
  top_rise_pct numeric
)
language sql security definer
set search_path = public
as $$
  with user_restaurants as (
    select p.id as user_id, r.id as restaurant_id, p.email, p.restaurant_name
    from public.profiles p
    join public.restaurants r on r.owner_id = p.id
    where p.email is not null
  ),
  scans as (
    select ur.user_id, count(i.id) as invoices_count
    from user_restaurants ur
    join public.invoices i
      on i.restaurant_id = ur.restaurant_id
     and i.status = 'processed'
     and i.created_at >= p_month_start
     and i.created_at < p_month_end
    group by ur.user_id
    having count(i.id) >= p_min_scans
  ),
  alerts_period as (
    select ur.user_id, count(ma.id) as alerts_count
    from user_restaurants ur
    left join public.margin_alerts ma
      on ma.restaurant_id = ur.restaurant_id
     and ma.created_at >= p_month_start
     and ma.created_at < p_month_end
    group by ur.user_id
  ),
  -- Pour chaque user, on isole l'alerte avec la plus grosse hausse du mois.
  -- DISTINCT ON (user_id) garantit une seule ligne par chef avec le max pct.
  top_rises as (
    select distinct on (ur.user_id)
      ur.user_id,
      ma.price_change_pct,
      prod.name as product_name
    from user_restaurants ur
    join public.margin_alerts ma on ma.restaurant_id = ur.restaurant_id
    left join public.products prod on prod.id = ma.product_id
    where ma.created_at >= p_month_start
      and ma.created_at < p_month_end
    order by ur.user_id, ma.price_change_pct desc nulls last
  ),
  recipes_per_user as (
    select ur.user_id, count(distinct rec.id) as recipes_count
    from user_restaurants ur
    left join public.recipes rec on rec.restaurant_id = ur.restaurant_id
    group by ur.user_id
  )
  select
    s.user_id,
    max(ur.email)::text as email,
    max(ur.restaurant_name)::text as restaurant_name,
    s.invoices_count,
    coalesce(ap.alerts_count, 0) as alerts_count_period,
    coalesce(rpu.recipes_count, 0) as recipes_total,
    tr.product_name as top_rise_product,
    tr.price_change_pct as top_rise_pct
  from scans s
  join user_restaurants ur on ur.user_id = s.user_id
  left join alerts_period ap on ap.user_id = s.user_id
  left join recipes_per_user rpu on rpu.user_id = s.user_id
  left join top_rises tr on tr.user_id = s.user_id
  group by s.user_id, s.invoices_count, ap.alerts_count, rpu.recipes_count,
           tr.product_name, tr.price_change_pct;
$$;

comment on function public.monthly_recap_candidates(timestamptz, timestamptz, int) is
  'Renvoie les chefs éligibles au récap mensuel avec stats DÉJÀ scopées par user_id (alerts, top rise, recipes). Migration 020 fix le scoping bug du cron.';

-- ─── Idempotency crons ───────────────────────────────────────────────────────
-- Évite les doubles emails si Vercel retrigger un cron (panne, redéploiement).
-- trial_reminder_sent_at : timestamp du dernier mail J-3 envoyé. Reset jamais
--   (un user qui s'abonne puis résilie peut re-trigger plus tard si on veut,
--   mais c'est out of scope pour l'instant).
-- last_monthly_recap_sent_at : timestamp du dernier récap mensuel envoyé.
--   Comparé avec date_trunc('month', ...) pour skip si déjà envoyé ce mois-ci.

alter table public.profiles
  add column if not exists trial_reminder_sent_at timestamptz,
  add column if not exists last_monthly_recap_sent_at timestamptz;

comment on column public.profiles.trial_reminder_sent_at is
  'Timestamp du mail trial-reminders J-3 envoyé. NULL = pas encore envoyé. Filtré dans /api/cron/trial-reminders pour idempotency.';
comment on column public.profiles.last_monthly_recap_sent_at is
  'Timestamp du dernier mail récap mensuel. Comparé au début du mois courant pour idempotency.';
