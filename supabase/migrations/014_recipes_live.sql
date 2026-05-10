-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014 — Module "Mes Recettes" : prix live + dérive + saisie manuelle
--
-- Étend le schéma existant (recipes / recipe_ingredients en place depuis 001)
-- pour supporter le module produit "Mes Recettes" :
--
--   1. Snapshot du coût au moment de la création/dernière baseline (pour drift).
--   2. Nom + unité snapshot au save (pour ne plus dépendre du produit s'il
--      est renommé/supprimé).
--   3. Saisie manuelle de secours (manual_price_ht) si un produit n'a jamais
--      été scanné — sans bloquer l'affichage de la recette.
--   4. Lien produit nullable : permet de saisir un ingrédient libre sans
--      catalogue (pré-requis pour le manual_price_ht qui marche tout seul).
--   5. Position pour ordonner les ingrédients dans l'UI.
--   6. Vue enrichie `recipes_with_health` : coût courant, marge brute, drift
--      vs baseline, statut santé. Calculée en live (pas de matérialisation),
--      conformément à la promesse "à chaque scan, recalcul auto".
--
-- Compat ascendante : aucune colonne supprimée ni renommée. Les anciens lots
-- (lib/invoice-processor.ts) qui requêtent recipe_ingredients par product_id
-- continuent à fonctionner — un ingrédient sans product_id est simplement
-- ignoré par ces lots (ce qui est le comportement souhaité, le manual price
-- n'a pas à déclencher d'alertes de marge).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extensions de recipes ──────────────────────────────────────────────────

alter table public.recipes
  add column if not exists baseline_cost_ht numeric(10, 4) not null default 0,
  add column if not exists baseline_recorded_at timestamptz not null default now(),
  add column if not exists notes text;

-- Backfill baseline : pour les recettes existantes (pré-014), on prend le
-- food_cost actuel comme baseline. Sans ça, le drift afficherait du bruit.
update public.recipes r
set
  baseline_cost_ht = coalesce(rcv.food_cost_ht, 0),
  baseline_recorded_at = r.created_at
from public.recipe_cost_view rcv
where rcv.recipe_id = r.id
  and r.baseline_cost_ht = 0;

-- ── 2. Extensions de recipe_ingredients ───────────────────────────────────────

-- product_id devient nullable : on autorise un ingrédient libre (sans produit
-- catalogué) si l'user saisit un manual_price_ht. ON DELETE SET NULL pour ne
-- pas perdre l'ingrédient si le produit est supprimé du catalogue.
alter table public.recipe_ingredients
  drop constraint if exists recipe_ingredients_product_id_fkey;
alter table public.recipe_ingredients
  alter column product_id drop not null,
  add constraint recipe_ingredients_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;

alter table public.recipe_ingredients
  add column if not exists label text,
  add column if not exists quantity_unit text,
  add column if not exists product_unit text,
  add column if not exists manual_price_ht numeric(10, 4),
  add column if not exists baseline_price_ht numeric(10, 4),
  add column if not exists position int not null default 0;

-- Backfill : pour les lignes pré-014, label et unités viennent du produit.
update public.recipe_ingredients ri
set
  label = coalesce(ri.label, p.name),
  quantity_unit = coalesce(ri.quantity_unit, ri.unit, p.unit),
  product_unit = coalesce(ri.product_unit, p.unit, ri.unit)
from public.products p
where p.id = ri.product_id
  and (ri.label is null or ri.quantity_unit is null or ri.product_unit is null);

-- Forcer un défaut non null sur label après backfill (au cas où un product_id
-- pointait sur un produit déjà supprimé).
update public.recipe_ingredients
set label = 'Ingrédient'
where label is null;

alter table public.recipe_ingredients
  alter column label set not null,
  alter column quantity_unit set default '',
  alter column product_unit set default '';

-- Garde-fou : un ingrédient doit avoir SOIT un product_id (= prix live), SOIT
-- un manual_price_ht (= prix de secours saisi). Sans l'un ni l'autre, la
-- recette ne peut pas se calculer — autant interdire l'insertion.
alter table public.recipe_ingredients
  drop constraint if exists recipe_ingredients_priceable_check;
alter table public.recipe_ingredients
  add constraint recipe_ingredients_priceable_check
  check (product_id is not null or manual_price_ht is not null);

-- ── 3. Fonction de conversion d'unités ───────────────────────────────────────
-- Limité aux familles métier (masse, volume). Les unités exotiques (botte,
-- piece, etc.) renvoient 1 — le calcul reste cohérent tant que l'user saisit
-- la même unité que celle du produit.

create or replace function public.unit_conversion_factor(
  from_unit text,
  to_unit text
) returns numeric
language sql
immutable
as $$
  select case
    when lower(coalesce(from_unit, '')) = lower(coalesce(to_unit, '')) then 1::numeric
    -- Masse : tout converti en kg
    when lower(from_unit) = 'g'  and lower(to_unit) = 'kg' then 0.001::numeric
    when lower(from_unit) = 'kg' and lower(to_unit) = 'g'  then 1000::numeric
    -- Volume : tout converti en L
    when lower(from_unit) = 'cl' and lower(to_unit) = 'l'  then 0.01::numeric
    when lower(from_unit) = 'ml' and lower(to_unit) = 'l'  then 0.001::numeric
    when lower(from_unit) = 'l'  and lower(to_unit) = 'cl' then 100::numeric
    when lower(from_unit) = 'l'  and lower(to_unit) = 'ml' then 1000::numeric
    -- ml ↔ cl
    when lower(from_unit) = 'ml' and lower(to_unit) = 'cl' then 0.1::numeric
    when lower(from_unit) = 'cl' and lower(to_unit) = 'ml' then 10::numeric
    else 1::numeric
  end;
$$;

-- ── 4. Vue enrichie : recipes_with_health ────────────────────────────────────
-- Une seule SELECT côté client suffit pour afficher la liste / le détail.
--
-- Champs :
--   - current_cost_ht         : coût matière courant, prend manual ou last scan
--   - has_unpriced_items      : true si au moins une ligne n'a aucun prix
--                                (ni manual ni scanné) — UI signale "incomplet"
--   - selling_price_ht        : prix de vente HT dérivé du TTC + TVA
--   - current_margin_pct      : taux de marge brute en %
--   - cost_drift_pct          : (current - baseline) / baseline × 100
--   - health                  : 'critical' < 70%, 'warning' 70-75%, 'ok' >= 75%
--                                NULL si selling_price absent

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
  case
    when r.selling_price is null or r.vat_rate is null
      or r.selling_price = 0 then null
    when ((r.selling_price / (1 + r.vat_rate / 100)) - coalesce(c.current_cost_ht, 0))
         / nullif(r.selling_price / (1 + r.vat_rate / 100), 0)
         * 100 < 70 then 'critical'
    when ((r.selling_price / (1 + r.vat_rate / 100)) - coalesce(c.current_cost_ht, 0))
         / nullif(r.selling_price / (1 + r.vat_rate / 100), 0)
         * 100 < 75 then 'warning'
    else 'ok'
  end as health
from public.recipes r
left join cost_agg c on c.recipe_id = r.id;

-- security_invoker : la vue respecte les RLS du caller (pareil que migration 010
-- qui a corrigé recipe_cost_view).
alter view public.recipes_with_health set (security_invoker = on);

-- ── 5. Vue détail ingrédient avec dérive par ligne ──────────────────────────
-- Pour le panneau "coupable" : qui a augmenté de combien depuis le baseline ?

drop view if exists public.recipe_ingredients_with_drift;
create view public.recipe_ingredients_with_drift as
select
  ri.id,
  ri.recipe_id,
  ri.product_id,
  ri.label,
  ri.quantity,
  ri.unit,
  ri.quantity_unit,
  ri.product_unit,
  ri.manual_price_ht,
  ri.baseline_price_ht,
  ri.position,
  -- Prix HT actuellement utilisé pour le calcul (manual prioritaire)
  coalesce(ri.manual_price_ht, latest.price_ht) as current_price_ht,
  latest.recorded_at as current_price_recorded_at,
  -- Sous-total HT courant (avec conversion d'unité)
  coalesce(ri.manual_price_ht, latest.price_ht, 0)
    * ri.quantity
    * public.unit_conversion_factor(
        coalesce(nullif(ri.quantity_unit, ''), ri.unit),
        coalesce(nullif(ri.product_unit, ''), ri.unit)
      ) as current_subtotal_ht,
  -- Dérive du prix unitaire vs baseline_price_ht (si baseline connu)
  case
    when ri.baseline_price_ht is null or ri.baseline_price_ht = 0 then null
    when coalesce(ri.manual_price_ht, latest.price_ht) is null then null
    else round(
      (coalesce(ri.manual_price_ht, latest.price_ht) - ri.baseline_price_ht)
      / ri.baseline_price_ht * 100,
      2
    )
  end as price_drift_pct
from public.recipe_ingredients ri
left join lateral (
  select price_ht, recorded_at
  from public.price_history
  where product_id = ri.product_id
  order by recorded_at desc
  limit 1
) latest on ri.product_id is not null;

alter view public.recipe_ingredients_with_drift set (security_invoker = on);

-- ── 6. Index pour la perf des vues ───────────────────────────────────────────

create index if not exists idx_recipe_ingredients_recipe
  on public.recipe_ingredients(recipe_id);
create index if not exists idx_recipes_restaurant
  on public.recipes(restaurant_id, updated_at desc);

-- ── 7. Trigger updated_at sur recipes ────────────────────────────────────────
-- Pour que la liste reflète l'ordre d'édition (utile pour "récemment touché").

create or replace function public.touch_recipe_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_recipes_updated_at on public.recipes;
create trigger trg_recipes_updated_at
  before update on public.recipes
  for each row execute function public.touch_recipe_updated_at();
