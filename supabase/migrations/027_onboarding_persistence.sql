-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 027 — Persistance serveur de l'onboarding
--
-- Problème : l'affichage des "messages de bienvenue" (modale d'onboarding +
-- célébration du premier scan) était piloté uniquement par localStorage
-- (`yield_onboarding_seen`, `yield_first_scan_celebrated`). localStorage est
-- scopé au navigateur/appareil → un chef qui se reconnecte sur un autre
-- appareil, après vidage du cache, en navigation privée ou via une nouvelle
-- install PWA revoyait toute la séquence d'accueil alors que son compte avait
-- déjà servi.
--
-- Fix : on déplace l'état "déjà vu" sur le compte (table profiles), comme
-- founder_letter_seen_at (migration 016) qui ne souffrait pas de ce bug.
--
--   1. onboarding_seen_at        — timestamp du dismiss de la modale d'accueil.
--                                   NULL = jamais vue.
--   2. first_scan_celebrated_at  — timestamp de l'affichage de la célébration
--                                   "Premier scan validé". NULL = jamais fêté.
--
-- Ces deux colonnes ne sont PAS protégées par le trigger anti-tampering
-- (migration 021/022) : le propriétaire peut les écrire via la RLS UPDATE
-- standard (auth.uid() = id), exactement comme founder_letter_seen_at.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists onboarding_seen_at timestamptz,
  add column if not exists first_scan_celebrated_at timestamptz;

-- ─── Backfill : soigner immédiatement les comptes déjà actifs ────────────────
-- Tout chef qui a au moins une facture processed a, par définition, déjà passé
-- l'onboarding et fêté son premier scan. On renseigne les deux timestamps pour
-- ces comptes afin qu'ils ne revoient JAMAIS la séquence d'accueil, sur aucun
-- appareil, dès l'application de cette migration (sans attendre un re-login ni
-- le self-heal client). On date au created_at du profil (valeur conservatrice
-- et stable, plutôt que now()).
--
-- Lien profiles → restaurants (owner_id) → invoices (restaurant_id), cf
-- monthly_recap_candidates (migration 016).

update public.profiles p
set
  onboarding_seen_at = coalesce(p.onboarding_seen_at, p.created_at, now()),
  first_scan_celebrated_at = coalesce(p.first_scan_celebrated_at, p.created_at, now())
where exists (
  select 1
  from public.restaurants r
  join public.invoices i on i.restaurant_id = r.id
  where r.owner_id = p.id
    and i.status = 'processed'
);
