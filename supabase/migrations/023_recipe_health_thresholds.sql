-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 023 — Re-calibration des seuils recipe health
--
-- BUG identifié en QA par Lucas : "j'entre une recette, je clique sur le
-- générateur de prix, j'accepte la suggestion, et l'app m'affiche immédiatement
-- une alerte rouge sur la marge."
--
-- Cause : incohérence entre le coefficient du générateur et les seuils de
-- couleur. Le générateur applique COEFFICIENT_PRIX = 3.3 sur le coût HT
-- (= règle d'or "30% food cost" restauration française) → produit une marge
-- brute de 69.7%. Les seuils de la vue recipes_with_health (migration 014)
-- étaient critical < 70%, warning 70-75%, ok ≥ 75%. Du coup tout prix
-- généré tombait pile sous le seuil critical.
--
-- 75% de marge brute = 25% food cost. C'est réaliste UNIQUEMENT pour les
-- bars/cafés (boissons). En cuisine traditionnelle / bistrot / brasserie,
-- la norme c'est 30-35% food cost (marge 65-70%). En cuisine premium avec
-- foie gras / Saint-Pierre, on tolère 35-40% (marge 60-65%).
--
-- Nouveaux seuils : ok ≥ 65 / warning [55, 65[ / critical < 55. Ça calibre
-- la signalétique sur la pratique réelle du marché français, et le coef
-- 3.3 du générateur tombe pile en zone verte confortable.
--
-- Si jamais tu veux des seuils par catégorie de plat (boissons vs entrées
-- vs plats principaux), c'est une feature future — pour V1 on garde des
-- seuils globaux.
-- ─────────────────────────────────────────────────────────────────────────────

drop view if exists public.recipes_with_health;
create view public.recipes_with_health as
with cost_agg as (
  select
    ri.recipe_id,
    sum(
      coalesce(ri.manual_price_ht, latest.price_ht, 0)
      * ri.quantity
      * public.unit_conversion_factor(
          coalesce(nullif(ri.quantity_unit, ''), ri.unit),
          coalesce(nullif(ri.product_unit, ''), ri.unit)
        )
    ) as current_cost_ht,
    bool_or(
      ri.manual_price_ht is null and latest.price_ht is null
    ) as has_unpriced_items,
    count(*) as items_count
  from public.recipe_ingredients ri
  left join lateral (
    select price_ht
    from public.price_history
    where product_id = ri.product_id
    order by recorded_at desc
    limit 1
  ) latest on ri.product_id is not null
  group by ri.recipe_id
)
select
  r.id,
  r.restaurant_id,
  r.name,
  r.selling_price,
  r.vat_rate,
  r.portions,
  r.category,
  r.notes,
  r.baseline_cost_ht,
  r.baseline_recorded_at,
  r.created_at,
  r.updated_at,
  coalesce(c.current_cost_ht, 0) as current_cost_ht,
  coalesce(c.has_unpriced_items, false) as has_unpriced_items,
  coalesce(c.items_count, 0) as items_count,
  case
    when r.selling_price is null or r.vat_rate is null then null
    else round(r.selling_price / (1 + r.vat_rate / 100), 4)
  end as selling_price_ht,
  case
    when r.selling_price is null or r.vat_rate is null
      or r.selling_price = 0 then null
    else round(
      ((r.selling_price / (1 + r.vat_rate / 100)) - coalesce(c.current_cost_ht, 0))
      / nullif(r.selling_price / (1 + r.vat_rate / 100), 0)
      * 100,
      2
    )
  end as current_margin_pct,
  case
    when r.baseline_cost_ht is null or r.baseline_cost_ht = 0 then null
    else round(
      (coalesce(c.current_cost_ht, 0) - r.baseline_cost_ht)
      / r.baseline_cost_ht
      * 100,
      2
    )
  end as cost_drift_pct,
  -- Seuils re-calibrés migration 023 : alignés sur la pratique restauration
  -- française (food cost 30-35% courant) et sur le coef 3.3 du générateur.
  case
    when r.selling_price is null or r.vat_rate is null
      or r.selling_price = 0 then null
    when ((r.selling_price / (1 + r.vat_rate / 100)) - coalesce(c.current_cost_ht, 0))
         / nullif(r.selling_price / (1 + r.vat_rate / 100), 0)
         * 100 < 55 then 'critical'
    when ((r.selling_price / (1 + r.vat_rate / 100)) - coalesce(c.current_cost_ht, 0))
         / nullif(r.selling_price / (1 + r.vat_rate / 100), 0)
         * 100 < 65 then 'warning'
    else 'ok'
  end as health
from public.recipes r
left join cost_agg c on c.recipe_id = r.id;

alter view public.recipes_with_health set (security_invoker = on);

comment on view public.recipes_with_health is
  'Recettes avec coût matière temps réel + marge + health (migration 023 : seuils 55/65 alignés restauration FR).';
