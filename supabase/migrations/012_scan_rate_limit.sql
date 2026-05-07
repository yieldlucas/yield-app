-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 012 — Rate limit court-terme sur les scans
--
-- Protège le budget Anthropic : sans cette garde, un user (ou un bug client)
-- peut envoyer 50 scans en 1 minute pendant son trial = ~1.50€ brûlé en 90s.
-- Limite : 5 scans / 2 minutes par user_id.
--
-- Articulation avec les autres limites :
--   - Migration 005 / 009 : check_and_increment_scan_usage = quota MENSUEL
--     (200 scans/mois, marge logique long-terme).
--   - Migration 012 (cette migration) : rate limit BURST (5/2min, protection
--     court-terme contre le spam).
-- Ordre d'appel côté API : rate_limit AVANT quota — si on est rate-limited,
-- on ne consomme pas le quota mensuel.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.scan_rate_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_scan_rate_log_user_time
  on public.scan_rate_log (user_id, attempted_at desc);

-- Pas de policy RLS : la table est purement interne, accédée uniquement par
-- la fonction check_scan_rate_limit (security definer). Aucun client ne la
-- lit en direct, donc l'activation seule de RLS sans policy bloque tout.
alter table public.scan_rate_log enable row level security;

/*
 * Compte les scans tentés par `p_user_id` dans la fenêtre `p_window_seconds`.
 * Si le quota burst est dépassé, retourne allowed=false + retry_after_seconds
 * (temps avant que le plus ancien attempt sorte de la fenêtre).
 * Sinon, insert un nouvel attempt et retourne allowed=true.
 *
 * Cleanup opportuniste : supprime les attempts hors fenêtre POUR CE USER à
 * chaque appel — garde la table petite sans cron dédié. Le coût additionnel
 * est négligeable (DELETE sur l'index user_id+attempted_at).
 */
create or replace function public.check_scan_rate_limit(
  p_user_id         uuid,
  p_max             integer default 5,
  p_window_seconds  integer default 120
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := now() - (p_window_seconds || ' seconds')::interval;
  v_count        integer;
  v_oldest       timestamptz;
begin
  delete from public.scan_rate_log
  where user_id = p_user_id and attempted_at < v_window_start;

  select count(*), min(attempted_at)
  into v_count, v_oldest
  from public.scan_rate_log
  where user_id = p_user_id;

  if v_count >= p_max then
    allowed := false;
    retry_after_seconds := greatest(
      ceil(extract(epoch from
        (v_oldest + (p_window_seconds || ' seconds')::interval - now())
      ))::integer,
      1
    );
    return next;
    return;
  end if;

  insert into public.scan_rate_log (user_id) values (p_user_id);
  allowed := true;
  retry_after_seconds := 0;
  return next;
end;
$$;
