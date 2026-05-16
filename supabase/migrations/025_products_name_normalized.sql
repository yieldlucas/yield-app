-- [audit-fix C4] ajout de name_normalized pour matcher les libellés produits
-- malgré les variations de casse, espaces, accents, ligatures et ponctuation.
--
-- Contexte : avant ce fix, upsertProduct() faisait .ilike("name", raw_label)
-- qui est juste un égal case-insensitive (sans wildcards). Conséquence :
-- "TOMATE GRAPPE 4KG" et "Tomate grappe 4 kg" créaient deux produits distincts,
-- la base produits explosait, et les alertes de hausse étaient muettes dans
-- 30-50% des cas (chaque "doublon" n'avait qu'une entrée d'historique).
--
-- Stratégie : on ajoute une colonne name_normalized qui contient la version
-- déterministe du libellé (lowercase + NFD + retrait ligatures + séparation
-- chiffres/unités + ponctuation→espace + collapse espaces). Le matching se
-- fait sur cette colonne, le name original est préservé pour l'affichage UI.

-- ── 1. Ajout de la colonne (nullable initialement pour le backfill) ─────────
-- Le défaut NULL est intentionnel : pour les rows pré-migration, le backfill
-- via le script scripts/backfill-product-names.ts (Deno/Node) renseignera
-- name_normalized en utilisant la même fonction JS que l'edge function. On
-- NE FAIT PAS le backfill en SQL pur car la normalisation utilise NFD +
-- regex JS qui peuvent diverger d'une implémentation SQL équivalente sur
-- les caractères Unicode complexes (œ → oe nécessite un mapping explicite
-- que SQL ne supporte pas nativement de la même façon que JS).

alter table public.products
  add column if not exists name_normalized text;

comment on column public.products.name_normalized is
  'Libellé normalisé (lowercase + NFD + ligatures + ponctuation) pour matcher les variations OCR. Backfill via scripts/backfill-product-names.ts. Voir migration 025.';

-- ── 2. Index pour les lookups de match exact post-normalisation ─────────────
-- À l'échelle 50 ambassadeurs × ~200 produits × N restaurants, l'index sur
-- (restaurant_id, name_normalized) accélère .eq().eq() en O(log n).

create index if not exists idx_products_name_normalized
  on public.products (restaurant_id, name_normalized);

-- ── 3. Vérification post-déploiement (info) ─────────────────────────────────
-- Après application de la migration ET exécution du script de backfill :
--
--   select count(*) from public.products where name_normalized is null;
--
-- Doit retourner 0 (tous les produits existants ont été backfillés).
-- Si > 0 : relancer le script de backfill (idempotent).
