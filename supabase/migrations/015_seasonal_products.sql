-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 015 — Produits saisonniers
--
-- Permet au chef de marquer un produit comme "saisonnier" : les variations
-- de prix attendues (tomate en hiver, asperge hors saison, etc.) ne génèrent
-- alors plus d'alertes. Sans ce flag, l'app spammerait des alertes attendues
-- → dégrade la confiance dans les alertes vraiment significatives.
--
-- Le filtrage est appliqué côté UI (la cloche) pour préserver l'historique
-- complet en BDD. Si l'user "dé-marque" un produit, ses anciennes alertes
-- redeviennent visibles.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.products
  add column if not exists is_seasonal boolean not null default false;

comment on column public.products.is_seasonal is
  'Marqué par le chef pour ignorer les alertes prix attendues (saisonnalité).';

-- Index partiel pour filtrer rapidement les alertes en excluant les
-- produits saisonniers. Petit (seulement les true), sélectif.
create index if not exists idx_products_seasonal
  on public.products(id) where is_seasonal = true;
