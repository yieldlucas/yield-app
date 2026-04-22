-- ============================================================
-- MargeChef - Schéma initial de base de données
-- Supabase / PostgreSQL
-- ============================================================

-- ============================================================
-- 1. RESTAURANTS
-- Un utilisateur peut gérer un ou plusieurs restaurants
-- ============================================================
create table restaurants (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  siret       text,
  created_at  timestamptz default now()
);

-- ============================================================
-- 2. FOURNISSEURS (Suppliers)
-- ============================================================
create table suppliers (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants(id) on delete cascade,
  name           text not null,
  contact_email  text,
  created_at     timestamptz default now()
);

-- ============================================================
-- 3. PRODUITS (catalogue d'ingrédients)
-- Un produit est lié à un fournisseur par défaut
-- ============================================================
create table products (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  supplier_id     uuid references suppliers(id) on delete set null,
  name            text not null,
  unit            text not null,          -- kg, L, pièce, barquette...
  category        text,                   -- viande, légume, poisson...
  reference_code  text,                   -- code produit fournisseur
  created_at      timestamptz default now(),
  unique (restaurant_id, name, unit)
);

-- ============================================================
-- 4. HISTORIQUE DES PRIX
-- Chaque scan de facture alimente cette table
-- ============================================================
create table price_history (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  price_ht      numeric(10, 4) not null,  -- Prix Hors Taxe par unité
  recorded_at   timestamptz default now(),
  invoice_id    uuid,                     -- FK ajoutée après création de invoices
  source        text default 'invoice'    -- 'invoice' | 'manual'
);

-- ============================================================
-- 5. FACTURES (Invoices)
-- Métadonnées + image stockée dans Supabase Storage
-- ============================================================
create table invoices (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  supplier_id     uuid references suppliers(id) on delete set null,
  invoice_date    date,
  invoice_number  text,
  image_path      text not null,          -- chemin dans Supabase Storage
  raw_ai_response jsonb,                  -- réponse brute Claude Vision
  status          text default 'pending', -- pending | processed | error
  created_at      timestamptz default now()
);

-- FK rétroactive sur price_history
alter table price_history
  add constraint fk_price_history_invoice
  foreign key (invoice_id) references invoices(id) on delete set null;

-- ============================================================
-- 6. LIGNES DE FACTURE (Invoice Items)
-- Détail extrait par l'IA
-- ============================================================
create table invoice_items (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references invoices(id) on delete cascade,
  product_id      uuid references products(id) on delete set null,
  raw_label       text not null,          -- libellé brut extrait par l'IA
  quantity        numeric(10, 3),
  unit            text,
  unit_price_ht   numeric(10, 4),
  total_price_ht  numeric(10, 4),
  vat_rate        numeric(5, 2),
  matched         boolean default false   -- produit reconnu dans le catalogue
);

-- ============================================================
-- 7. FICHES TECHNIQUES (Recettes)
-- ============================================================
create table recipes (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants(id) on delete cascade,
  name           text not null,
  selling_price  numeric(10, 2),          -- Prix de vente TTC
  vat_rate       numeric(5, 2) default 10,
  portions       integer default 1,
  category       text,                    -- entrée, plat, dessert...
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ============================================================
-- 8. INGRÉDIENTS D'UNE FICHE TECHNIQUE
-- ============================================================
create table recipe_ingredients (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references recipes(id) on delete cascade,
  product_id  uuid not null references products(id) on delete restrict,
  quantity    numeric(10, 4) not null,    -- quantité pour X portions
  unit        text not null
);

-- ============================================================
-- 9. ALERTES DE MARGE
-- Générées automatiquement lors d'un scan de facture
-- ============================================================
create table margin_alerts (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references restaurants(id) on delete cascade,
  product_id        uuid not null references products(id) on delete cascade,
  invoice_id        uuid references invoices(id) on delete set null,
  old_price         numeric(10, 4) not null,
  new_price         numeric(10, 4) not null,
  price_change_pct  numeric(6, 2) not null,    -- ex: +8.5 = +8.5%
  affected_recipes  jsonb,                      -- [{id, name, margin_impact}]
  is_read           boolean default false,
  created_at        timestamptz default now()
);

-- ============================================================
-- VUE : Coût matière actuel par recette
-- ============================================================
create or replace view recipe_cost_view as
select
  r.id                                          as recipe_id,
  r.restaurant_id,
  r.name                                        as recipe_name,
  r.selling_price,
  r.portions,
  sum(ri.quantity * latest.price_ht)            as food_cost_ht,
  round(
    (sum(ri.quantity * latest.price_ht) / nullif(r.selling_price / (1 + r.vat_rate / 100), 0)) * 100,
    2
  )                                             as food_cost_pct,
  round(
    100 - (sum(ri.quantity * latest.price_ht) / nullif(r.selling_price / (1 + r.vat_rate / 100), 0)) * 100,
    2
  )                                             as margin_pct
from recipes r
join recipe_ingredients ri on ri.recipe_id = r.id
join lateral (
  select price_ht
  from price_history
  where product_id = ri.product_id
  order by recorded_at desc
  limit 1
) latest on true
group by r.id, r.restaurant_id, r.name, r.selling_price, r.portions, r.vat_rate;

-- ============================================================
-- INDEX pour les performances
-- ============================================================
create index idx_price_history_product_date   on price_history(product_id, recorded_at desc);
create index idx_invoices_restaurant          on invoices(restaurant_id, created_at desc);
create index idx_margin_alerts_restaurant     on margin_alerts(restaurant_id, is_read, created_at desc);
create index idx_products_restaurant          on products(restaurant_id);
create index idx_invoice_items_invoice        on invoice_items(invoice_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Chaque restaurateur ne voit que ses propres données
-- ============================================================
alter table restaurants       enable row level security;
alter table suppliers         enable row level security;
alter table products          enable row level security;
alter table price_history     enable row level security;
alter table invoices          enable row level security;
alter table invoice_items     enable row level security;
alter table recipes           enable row level security;
alter table recipe_ingredients enable row level security;
alter table margin_alerts     enable row level security;

-- Politique : owner uniquement via restaurant
create policy "owner_restaurants"        on restaurants        using (owner_id = auth.uid());
create policy "owner_suppliers"          on suppliers          using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
create policy "owner_products"           on products           using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
create policy "owner_invoices"           on invoices           using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
create policy "owner_invoice_items"      on invoice_items      using (invoice_id in (select id from invoices where restaurant_id in (select id from restaurants where owner_id = auth.uid())));
create policy "owner_price_history"      on price_history      using (product_id in (select id from products where restaurant_id in (select id from restaurants where owner_id = auth.uid())));
create policy "owner_recipes"            on recipes            using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));
create policy "owner_recipe_ingredients" on recipe_ingredients using (recipe_id in (select id from recipes where restaurant_id in (select id from restaurants where owner_id = auth.uid())));
create policy "owner_margin_alerts"      on margin_alerts      using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- ============================================================
-- TRIGGER : updated_at automatique sur recipes
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_recipes_updated_at
  before update on recipes
  for each row execute function update_updated_at();
