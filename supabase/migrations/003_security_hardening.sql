-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003 — Security hardening
-- R1. Trigger : interdit la modification de is_subscribed / stripe_customer_id
--     par les utilisateurs (seul le rôle service_role passe → webhook Stripe).
-- R2. WITH CHECK sur les 9 policies RLS (INSERT/UPDATE blindés).
-- R3. Force le bucket "invoices" en privé.
-- R5. Unique index sur (restaurant_id, supplier_id, invoice_number) pour
--     bloquer les doublons de scan.
-- ─────────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────
-- R1. Anti-fraude abonnement
-- ──────────────────────────────────────────────────────────
-- Sans ce trigger, n'importe quel user authentifié peut faire depuis sa
-- console DevTools : supabase.from('profiles').update({is_subscribed:true})
-- → il devient abonné gratuit (la policy RLS UPDATE le permet, et Postgres
-- ne sait pas filtrer par colonne via une simple policy).
create or replace function public.prevent_subscription_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Le webhook Stripe utilise SUPABASE_SERVICE_ROLE_KEY → role = 'service_role'
  -- Tout le reste (clé anon + JWT user) → role = 'authenticated' ou 'anon'
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.is_subscribed is distinct from old.is_subscribed then
    raise exception 'is_subscribed can only be modified by service role'
      using errcode = '42501';
  end if;

  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'stripe_customer_id can only be modified by service role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_subscription_tampering on public.profiles;
create trigger trg_prevent_subscription_tampering
  before update on public.profiles
  for each row execute function public.prevent_subscription_tampering();


-- ──────────────────────────────────────────────────────────
-- R2. WITH CHECK sur les 9 tables
-- ──────────────────────────────────────────────────────────
-- `using` = quelles lignes je peux VOIR (SELECT/UPDATE/DELETE)
-- `with check` = quel état la ligne peut AVOIR après INSERT/UPDATE
-- Sans with check : un user pouvait INSERT avec un restaurant_id étranger,
-- ou UPDATE pour transférer ses lignes vers un autre restaurant.

drop policy if exists "owner_restaurants" on public.restaurants;
create policy "owner_restaurants" on public.restaurants
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "owner_suppliers" on public.suppliers;
create policy "owner_suppliers" on public.suppliers
  using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

drop policy if exists "owner_products" on public.products;
create policy "owner_products" on public.products
  using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

drop policy if exists "owner_invoices" on public.invoices;
create policy "owner_invoices" on public.invoices
  using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

drop policy if exists "owner_invoice_items" on public.invoice_items;
create policy "owner_invoice_items" on public.invoice_items
  using (invoice_id in (
    select id from public.invoices
    where restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  ))
  with check (invoice_id in (
    select id from public.invoices
    where restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  ));

drop policy if exists "owner_price_history" on public.price_history;
create policy "owner_price_history" on public.price_history
  using (product_id in (
    select id from public.products
    where restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  ))
  with check (product_id in (
    select id from public.products
    where restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  ));

drop policy if exists "owner_recipes" on public.recipes;
create policy "owner_recipes" on public.recipes
  using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

drop policy if exists "owner_recipe_ingredients" on public.recipe_ingredients;
create policy "owner_recipe_ingredients" on public.recipe_ingredients
  using (recipe_id in (
    select id from public.recipes
    where restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  ))
  with check (recipe_id in (
    select id from public.recipes
    where restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  ));

drop policy if exists "owner_margin_alerts" on public.margin_alerts;
create policy "owner_margin_alerts" on public.margin_alerts
  using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));


-- ──────────────────────────────────────────────────────────
-- R3. Bucket invoices forcé en privé
-- ──────────────────────────────────────────────────────────
update storage.buckets set public = false where id = 'invoices';


-- ──────────────────────────────────────────────────────────
-- R5. Anti-doublon de facture
-- ──────────────────────────────────────────────────────────
-- Index partiel : ne contraint que les factures avec invoice_number ET supplier
-- renseignés (sinon trop de faux positifs sur les BL où l'IA n'a pas extrait
-- ces champs). L'edge function attrape 23505 et marque la facture en
-- 'duplicate' au lieu de continuer le pipeline.
create unique index if not exists uniq_invoice_per_supplier
  on public.invoices (restaurant_id, supplier_id, invoice_number)
  where invoice_number is not null and supplier_id is not null;

-- Le status 'duplicate' n'existait pas dans le schéma initial. Pas de check
-- constraint sur status, donc rien à modifier — on ajoute juste la valeur
-- dans la doc de la colonne pour la postérité.
comment on column public.invoices.status is
  'pending | processing | processed | error | duplicate';
