-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009 — Vérification + incrémentation atomique du quota mensuel
--
-- Fixe une race condition : la vérification du quota dans /api/invoices/process
-- était un SELECT séparé de l'INSERT/UPDATE fait par l'edge function en fin de
-- pipeline. Deux requêtes simultanées (used = 199, quota = 200) pouvaient toutes
-- deux passer la vérification puis incrémenter, atterrissant à used = 201.
--
-- Cette fonction fait check + reserve en une seule transaction avec FOR UPDATE.
-- Si le scan échoue (Claude crash, image illisible, doublon), l'API appelle
-- decrement_scan_usage en compensation pour ne pas brûler le crédit du user.
--
-- À partir de 009, check_and_increment_scan_usage est le SEUL juge de paix
-- du quota — le simple increment_scan_usage est marqué deprecated.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.check_and_increment_scan_usage(
  p_restaurant_id uuid,
  p_quota         integer default 200
)
returns table (allowed boolean, used integer, quota integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_used  integer;
begin
  -- Crée la ligne du mois si absente, sans incrémenter encore (count = 0).
  insert into public.usage_stats (restaurant_id, year_month, scan_count, updated_at)
  values (p_restaurant_id, v_month, 0, now())
  on conflict (restaurant_id, year_month) do nothing;

  -- Verrouille la ligne pour empêcher les courses entre transactions concurrentes.
  -- FOR UPDATE bloque les autres tx jusqu'à commit/rollback de celle-ci.
  select scan_count into v_used
  from public.usage_stats
  where restaurant_id = p_restaurant_id and year_month = v_month
  for update;

  if v_used >= p_quota then
    allowed := false;
    used    := v_used;
    quota   := p_quota;
    return next;
    return;
  end if;

  update public.usage_stats
  set scan_count = scan_count + 1, updated_at = now()
  where restaurant_id = p_restaurant_id and year_month = v_month;

  allowed := true;
  used    := v_used + 1;
  quota   := p_quota;
  return next;
end;
$$;

-- Compensation : si le scan échoue après la réservation, on rend le crédit.
-- greatest(..., 0) = filet de sécurité, ne devrait jamais déclencher.
create or replace function public.decrement_scan_usage(p_restaurant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_count integer;
begin
  update public.usage_stats
  set scan_count = greatest(scan_count - 1, 0), updated_at = now()
  where restaurant_id = p_restaurant_id and year_month = v_month
  returning scan_count into v_count;
  return coalesce(v_count, 0);
end;
$$;

comment on function public.increment_scan_usage(uuid) is
  'DEPRECATED depuis migration 009. Utiliser check_and_increment_scan_usage qui fait check + reserve atomique.';
