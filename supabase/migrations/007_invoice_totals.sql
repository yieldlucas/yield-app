-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — Totaux et variation par facture
--
-- Pour la timeline du dashboard : on a besoin du total HT et de la variation
-- globale (par rapport au prix précédent des mêmes produits) pour chaque BL.
--
-- Ces valeurs sont calculées en fin de pipeline edge function et stockées
-- sur invoices pour éviter un recalcul lourd à chaque chargement du dashboard.
--
-- variation_pct = ((Σ prix_actuel × qté) - (Σ prix_précédent × qté)) / (Σ prix_précédent × qté) * 100
-- pour les items qui avaient un prix_précédent. NULL si aucune comparaison
-- possible (premier scan d'un fournisseur, tous les produits sont nouveaux).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.invoices
  add column if not exists total_ht       numeric(12, 2),
  add column if not exists variation_pct  numeric(6, 2);

comment on column public.invoices.total_ht is
  'Total HT calculé = somme des total_price_ht des invoice_items.';
comment on column public.invoices.variation_pct is
  'Variation % vs prix précédent des mêmes produits (NULL si aucun comparable).';
