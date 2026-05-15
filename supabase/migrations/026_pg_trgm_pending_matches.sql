-- [audit-fix C4] détection des quasi-matches OCR (Temps 2)
--
-- Le Temps 1 a réglé les doublons exact-match post-normalisation. Mais des
-- variations comme "Tomate grappe BIO 4kg" vs "Tomate grappe 4kg" génèrent
-- toujours des produits distincts (name_normalized différents). Le Temps 2
-- ajoute une recherche par similarité Trigram (pg_trgm) pour proposer des
-- candidats au chef AVANT de créer un nouveau produit.
--
-- 4 changements de schéma dans cette migration :
--   1. Activation extension pg_trgm
--   2. Index GIN trigram sur products(name_normalized) pour scaler la similarité
--   3. Colonne invoice_items.pending_match boolean pour identifier les rows
--      en attente de validation (product_id = NULL + raw_label, quantity, prix
--      conservés pour rester comptés dans total_ht)
--   4. Table pending_product_matches qui stocke les candidats proposés par
--      l'edge function pour chaque item en attente

-- ── 1. Extension pg_trgm ───────────────────────────────────────────────────
-- Active la similarité trigram + l'opérateur `%` et la fonction `similarity()`.

create extension if not exists pg_trgm;

-- ── 2. Index trigram GIN sur products.name_normalized ──────────────────────
-- Sans cet index, `name_normalized % $1` ferait un scan séquentiel sur tous
-- les produits du restaurant. Avec l'index GIN, le lookup est ~constant en
-- latence quel que soit le volume.

create index if not exists idx_products_name_normalized_trgm
  on public.products using gin (name_normalized gin_trgm_ops);

-- ── 3. Colonne pending_match sur invoice_items ─────────────────────────────
-- Permet de tracer les rows invoice_items dont le product_id n'a pas encore
-- été résolu (le chef doit valider un candidat ou créer un nouveau produit).
-- Default false → comportement préservé pour les rows existantes.
--
-- Décision d'architecture (cf décision 2 du brief Temps 2) : on garde la row
-- invoice_items même sans product_id résolu pour que total_ht facture reste
-- complet. Différent du cas "empty_label" où on skip entièrement la row :
-- ici on a un raw_label exploitable + quantité + prix lus, donc tout pour
-- créer la row. La résolution future viendra mettre à jour product_id +
-- pending_match=false + déclencher price_history + alertes.

alter table public.invoice_items
  add column if not exists pending_match boolean not null default false;

comment on column public.invoice_items.pending_match is
  'true si product_id n''est pas encore résolu (quasi-match en attente de validation chef). Voir migration 026 et pending_product_matches.';

-- Index partiel sur les rows en attente (petit, sélectif → UI compteur rapide).
create index if not exists idx_invoice_items_pending_match
  on public.invoice_items (invoice_id)
  where pending_match = true;

-- ── 4. Table pending_product_matches ───────────────────────────────────────
-- Stocke les candidats proposés pour chaque invoice_item en attente. La
-- résolution côté UI viendra mettre à jour `resolved_at` + `resolution`,
-- puis MAJ la row invoice_items correspondante.

create table if not exists public.pending_product_matches (
  id                    uuid primary key default gen_random_uuid(),
  restaurant_id         uuid not null references public.restaurants(id) on delete cascade,
  invoice_id            uuid not null references public.invoices(id) on delete cascade,
  invoice_item_id       uuid not null references public.invoice_items(id) on delete cascade,
  raw_label             text not null,
  normalized_label      text not null,
  unit                  text not null,
  candidate_product_ids jsonb not null,          -- [{ product_id, name, similarity }]
  created_at            timestamptz not null default now(),
  resolved_at           timestamptz,
  resolution            text                      -- 'merged' | 'created_new' | null
                        check (resolution is null or resolution in ('merged', 'created_new'))
);

comment on table public.pending_product_matches is
  'Items OCR dont le produit ressemble à un existant (similarité trigram >= 0.85). En attente de validation côté UI. Voir migration 026 et docs/ui-todo-pending-matches.md.';

-- Index pour la query UI "tous mes pending non résolus" :
create index if not exists idx_pending_matches_unresolved
  on public.pending_product_matches (restaurant_id, created_at desc)
  where resolved_at is null;

-- ── 5. RLS pending_product_matches ─────────────────────────────────────────
-- Owner via restaurant_id → restaurants.owner_id = auth.uid().

alter table public.pending_product_matches enable row level security;

drop policy if exists "owner_pending_product_matches" on public.pending_product_matches;
create policy "owner_pending_product_matches" on public.pending_product_matches
  using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

-- ── 6. Vérification post-migration (info) ──────────────────────────────────
-- Ces 3 queries doivent fonctionner sans erreur après application :
--
--   select 'tomate' % 'tomato';                                              -- → true ou false (selon threshold session)
--   select indexname from pg_indexes where indexname = 'idx_products_name_normalized_trgm';
--   select count(*) from public.pending_product_matches;                     -- → 0 (table vide à la création)
