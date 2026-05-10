-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 013 — Vue produits + dernier prix connu
--
-- Pour la FlashCalculator (volet de calcul rapide marge/coût) : besoin d'un
-- endpoint léger qui renvoie {id, name, unit, last_price} pour chaque produit
-- du restaurant. Le faire côté JS impliquerait N+1 SELECTs sur price_history.
-- Une vue avec JOIN LATERAL fait ça en 1 SELECT, indexé sur
-- price_history(product_id, recorded_at desc) qui existe déjà (migration 001).
--
-- security_invoker = on : la vue respecte les RLS du caller (même protection
-- que recipe_cost_view depuis la migration 010).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.products_with_last_price as
select
  p.id,
  p.restaurant_id,
  p.name,
  p.unit,
  p.category,
  p.reference_code,
  p.supplier_id,
  p.created_at,
  latest.price_ht    as last_price_ht,
  latest.recorded_at as last_price_at
from public.products p
left join lateral (
  select price_ht, recorded_at
  from public.price_history
  where product_id = p.id
  order by recorded_at desc
  limit 1
) latest on true;

alter view public.products_with_last_price set (security_invoker = on);

comment on view public.products_with_last_price is
  'Catalogue produits enrichi du dernier prix HT connu (price_history le plus récent). Utilisé par FlashCalculator pour l''autocomplete.';
