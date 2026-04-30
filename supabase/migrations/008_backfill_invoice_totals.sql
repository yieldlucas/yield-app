-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — Backfill total_ht pour les factures pré-007
--
-- Les factures traitées avant la migration 007 n'ont jamais eu leur total_ht
-- calculé → la timeline affiche "—" pour le montant. On le calcule rétro à
-- partir de la somme des invoice_items.
--
-- Pas de backfill pour variation_pct : ça nécessiterait de remonter le temps
-- dans price_history avec exclusion de l'invoice elle-même, lourd. On laisse
-- NULL pour les anciennes (le badge affichera "—" comme avant).
-- ─────────────────────────────────────────────────────────────────────────────

update public.invoices i
set total_ht = sub.sum_total
from (
  select invoice_id, round(sum(total_price_ht)::numeric, 2) as sum_total
  from public.invoice_items
  group by invoice_id
) sub
where sub.invoice_id = i.id
  and i.status = 'processed'
  and i.total_ht is null;
