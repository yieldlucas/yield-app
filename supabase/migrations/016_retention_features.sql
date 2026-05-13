-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 016 — Rétention : numéro fondateur, lettre Lucas, code parrain
--
-- Objectif : transformer l'expérience d'arrivée pour que le chef se sente
-- intégré à une "famille" plutôt qu'inscrit à un SaaS. Les 4 colonnes
-- ajoutées sur profiles :
--
--   1. founder_number       — rang de signup (incrémenté à l'arrivée).
--                              Affiché en badge "Membre #007".
--   2. founder_letter_seen_at — timestamp du clic sur "Compris" dans la
--                                modale lettre de Lucas. NULL = pas encore vu.
--   3. referral_code        — code unique par user (ex: "MARC-A8F2") pour
--                              partage WhatsApp. Auto-généré.
--   4. referred_by_code     — code utilisé lors de l'inscription. Permet de
--                              compter "X chefs ont rejoint grâce à toi".
--
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists founder_number int,
  add column if not exists founder_letter_seen_at timestamptz,
  add column if not exists referral_code text,
  add column if not exists referred_by_code text;

-- Unicité du referral_code (mais NULL toléré pour les comptes pré-migration).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_referral_code_key'
  ) then
    alter table public.profiles
      add constraint profiles_referral_code_key unique (referral_code);
  end if;
end $$;

-- Index sur referred_by_code pour le compteur "X chefs grâce à toi" rapide.
create index if not exists idx_profiles_referred_by_code
  on public.profiles(referred_by_code) where referred_by_code is not null;

-- ─── Fonction : générer un referral_code lisible et stable ───────────────────
-- Format : 4 lettres aléatoires + 4 hex (ex: "MARC-A8F2"). Pas de mots
-- offensants possibles (pas de voyelles dans la 1ère moitié → moins de chance
-- de tomber sur un mot). Court, mémorisable, facile à dicter en WhatsApp.

create or replace function public.generate_referral_code()
returns text language plpgsql as $$
declare
  consonants text := 'BCDFGHJKLMNPQRSTVWXZ';
  hex_chars text := '0123456789ABCDEF';
  prefix text := '';
  suffix text := '';
  i int;
begin
  for i in 1..4 loop
    prefix := prefix || substr(consonants, 1 + floor(random() * length(consonants))::int, 1);
  end loop;
  for i in 1..4 loop
    suffix := suffix || substr(hex_chars, 1 + floor(random() * length(hex_chars))::int, 1);
  end loop;
  return prefix || '-' || suffix;
end;
$$;

-- ─── Fonction : assigner le founder_number + referral_code à un profile ─────
-- Idempotente : si déjà rempli, on ne touche pas. Appelée par le webhook
-- /api/webhooks/auth/user-created côté Next, OU par le backfill ci-dessous.
-- Le founder_number est calculé via row_number sur created_at — stable même
-- si un user est supprimé après (les rangs ne se décalent pas).

create or replace function public.assign_founder_metadata(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  next_number int;
  new_code text;
begin
  -- founder_number : compte des profiles créés strictement avant lui + 1.
  -- Stable car basé sur created_at (timestamp avec précision µs).
  update public.profiles p
  set founder_number = coalesce(p.founder_number, (
    select count(*) + 1
    from public.profiles
    where created_at < p.created_at
  ))
  where id = p_user_id
    and p.founder_number is null
  returning founder_number into next_number;

  -- referral_code : retry jusqu'à 10× si collision (improbable mais possible).
  if exists (select 1 from public.profiles where id = p_user_id and referral_code is null) then
    for i in 1..10 loop
      new_code := public.generate_referral_code();
      begin
        update public.profiles
        set referral_code = new_code
        where id = p_user_id and referral_code is null;
        exit;
      exception when unique_violation then
        new_code := null; -- retry
      end;
    end loop;
  end if;
end;
$$;

-- ─── Fonction RPC : candidats pour le récap mensuel ─────────────────────────
-- Renvoie les chefs qui ont >= p_min_scans BL processed dans la fenêtre
-- [p_month_start, p_month_end). Utilisé par /api/cron/monthly-recap.
-- security definer pour bypass RLS (le cron tourne avec service_role mais
-- la fonction permet aussi d'éviter des soucis d'arborescence RLS).

create or replace function public.monthly_recap_candidates(
  p_month_start timestamptz,
  p_month_end timestamptz,
  p_min_scans int default 5
)
returns table (
  user_id uuid,
  email text,
  restaurant_name text,
  invoices_count bigint
)
language sql security definer as $$
  select
    p.id as user_id,
    p.email,
    p.restaurant_name,
    count(i.id) as invoices_count
  from public.profiles p
  join public.restaurants r on r.owner_id = p.id
  join public.invoices i on i.restaurant_id = r.id
  where i.status = 'processed'
    and i.created_at >= p_month_start
    and i.created_at < p_month_end
    and p.email is not null
  group by p.id, p.email, p.restaurant_name
  having count(i.id) >= p_min_scans;
$$;

-- ─── Backfill : assigner founder_number + referral_code aux profiles existants
-- Ordonne par created_at pour que les premiers comptes aient les plus petits
-- numéros (Lucas = #1 si il a un profile, ses 15 chefs du Gers = #2-#16, etc.).

do $$
declare
  rec record;
begin
  for rec in
    select id from public.profiles
    where founder_number is null or referral_code is null
    order by created_at asc
  loop
    perform public.assign_founder_metadata(rec.id);
  end loop;
end $$;
