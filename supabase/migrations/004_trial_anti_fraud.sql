-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — Trial anti-fraud (O6)
-- Empêche un user de regagner 14 jours d'essai en se ré-inscrivant avec
-- un alias email (lacelarie+1@gmail.com, lacelarie+2@gmail.com, etc.)
-- ou en jouant avec la casse.
--
-- Stratégie : colonne normalized_email auto-calculée + index, puis la route
-- /api/invoices/process refuse le trial si une autre profile existe déjà
-- avec le même email normalisé créée AVANT celle de l'utilisateur courant.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists normalized_email text;

create index if not exists idx_profiles_normalized_email
  on public.profiles(normalized_email);

-- Normalisation : lowercase + strip de la partie "+xxx" du local-part
-- ex: Lucas.LACELARIE+test@Gmail.com → lucas.lacelarie@gmail.com
create or replace function public.set_normalized_email()
returns trigger
language plpgsql
as $$
begin
  if new.email is null then
    new.normalized_email := null;
    return new;
  end if;
  new.normalized_email :=
    lower(regexp_replace(split_part(new.email, '@', 1), '\+.*$', ''))
    || '@'
    || lower(split_part(new.email, '@', 2));
  return new;
end;
$$;

drop trigger if exists trg_set_normalized_email on public.profiles;
create trigger trg_set_normalized_email
  before insert or update of email on public.profiles
  for each row execute function public.set_normalized_email();

-- Backfill : force le trigger à s'exécuter sur toutes les lignes existantes.
-- L'astuce `email = email` déclenche `before update of email` même si la
-- valeur ne change pas réellement.
update public.profiles set email = email where email is not null;
