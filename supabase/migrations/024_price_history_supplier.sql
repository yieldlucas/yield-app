-- [audit-fix C5] ajout de supplier_id à price_history pour permettre la comparaison
-- de prix par couple (product_id, supplier_id) et éviter les fausses alertes
-- inter-fournisseurs. Les rows source='manual' ont supplier_id NULL par design.
--
-- Contexte : avant ce fix, getLastPrice(productId) renvoyait le dernier prix
-- TOUS FOURNISSEURS CONFONDUS. Quand un chef passait de Metro à Promocash sur
-- la même tomate, l'app affichait une fausse alerte de hausse (+50%) alors que
-- c'est juste un changement de fournisseur. Avec supplier_id directement sur
-- price_history, la comparaison se fait par couple (product, supplier) et le
-- changement de fournisseur ne déclenche plus de fausse alerte.

-- ── 1. Ajout de la colonne ───────────────────────────────────────────────────
-- ON DELETE SET NULL : perdre l'historique de prix parce qu'un supplier est
-- supprimé serait destructeur. Aligné avec le pattern existant pour
-- invoices.supplier_id (migration 001 ligne 36) qui utilise aussi SET NULL.

alter table public.price_history
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

-- ── 2. Backfill des rows existantes ──────────────────────────────────────────
-- Source de vérité : invoices.supplier_id pour chaque row où invoice_id est
-- renseigné. Les rows source='manual' (invoice_id NULL) restent supplier_id NULL
-- INTENTIONNELLEMENT : un prix manuel sans supplier n'est pas un baseline "par
-- fournisseur" et doit être exclu naturellement du filtre .eq("supplier_id", ?)
-- côté getLastPrice. Ce NULL n'est PAS une donnée manquante à compléter — c'est
-- un état sémantique légitime.
--
-- La clause AND supplier_id IS NULL rend l'UPDATE idempotent : si la migration
-- est rejouée (cas improbable de rollback partiel), on ne réécrit pas les
-- valeurs déjà backfillées.

update public.price_history ph
set supplier_id = i.supplier_id
from public.invoices i
where ph.invoice_id = i.id
  and ph.supplier_id is null;

-- ── 3. Index pour la performance ─────────────────────────────────────────────
-- À l'échelle de 50 ambassadeurs × 100 BL/mois × ~10 lignes par BL, price_history
-- grossit vite (~60k rows/an). L'index (product_id, supplier_id, recorded_at DESC)
-- transforme le lookup de getLastPrice en O(log n) au lieu d'un scan filtré.

create index if not exists idx_price_history_product_supplier_recorded
  on public.price_history (product_id, supplier_id, recorded_at desc);

-- ── 4. Vérification manuelle post-déploiement (info) ────────────────────────
-- Après application, exécuter dans Supabase SQL Editor :
--
--   select count(*) from public.price_history
--    where invoice_id is not null and supplier_id is null;
--
-- Doit retourner 0 si le backfill a réussi. Si > 0 : enquêter sur les rows
-- (invoice_id pointe sur une facture sans supplier_id ? facture en cours de
-- traitement ? données corrompues ?).
