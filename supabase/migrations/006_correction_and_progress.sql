-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — Correction tracking & progression scan
--
-- 1. invoice_items : on garde l'original_unit_price / original_quantity pour
--    pouvoir afficher "valeur IA → valeur corrigée" dans le détail facture
--    et permettre un revert. corrected_at = horodatage de la dernière édition.
-- 2. invoices : processing_step + total_items_count permettent au client de
--    polling de savoir où en est le scan ("Lecture des lignes...", "Analyse
--    des 12 produits..."). status reste la source de vérité (pending /
--    processing / processed / error / duplicate) — processing_step est un
--    sous-état affiché uniquement pendant 'processing'.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.invoice_items
  add column if not exists original_unit_price numeric(10, 4),
  add column if not exists original_quantity   numeric(10, 3),
  add column if not exists corrected_at        timestamptz;

alter table public.invoices
  add column if not exists processing_step    text,
  add column if not exists total_items_count  integer;

comment on column public.invoices.processing_step is
  'extracting | matching | alerting (sous-étape pendant status=processing)';

comment on column public.invoice_items.original_unit_price is
  'Prix extrait par l''IA — figé au moment de la création. unit_price_ht peut être édité par le chef.';
