// Helpers de lecture / mutation pour le module Mes Recettes.
//
// La RLS Supabase fait le scoping (owner_recipes / owner_recipe_ingredients +
// security_invoker sur les vues), pas de re-vérif côté client.

import { supabase } from "@/lib/supabase-browser";

export type RecipeHealth = "ok" | "warning" | "critical" | null;

export type RecipeListRow = {
  id: string;
  name: string;
  selling_price: number | null;
  vat_rate: number | null;
  current_cost_ht: number;
  current_margin_pct: number | null;
  cost_drift_pct: number | null;
  baseline_cost_ht: number;
  baseline_recorded_at: string;
  has_unpriced_items: boolean;
  items_count: number;
  health: RecipeHealth;
  updated_at: string;
};

export type RecipeIngredientRow = {
  id: string;
  recipe_id: string;
  product_id: string | null;
  label: string;
  quantity: number;
  /** Unité originale stockée dans `unit` (col legacy, conservée par compat). */
  unit: string;
  /** Unité saisie (peut différer de l'unité produit, ex: "g" pour un produit kg). */
  quantity_unit: string;
  /** Unité du produit catalogue au moment du save (kg, L, pièce…). */
  product_unit: string;
  manual_price_ht: number | null;
  baseline_price_ht: number | null;
  position: number;
  current_price_ht: number | null;
  current_price_recorded_at: string | null;
  current_subtotal_ht: number;
  price_drift_pct: number | null;
};

export type RecipeDetail = RecipeListRow & {
  notes: string | null;
  ingredients: RecipeIngredientRow[];
};

/** Liste des recettes, triées par dernière modif. */
export async function fetchRecipes(): Promise<RecipeListRow[]> {
  const { data, error } = await supabase
    .from("recipes_with_health")
    .select(
      "id, name, selling_price, vat_rate, current_cost_ht, current_margin_pct, cost_drift_pct, baseline_cost_ht, baseline_recorded_at, has_unpriced_items, items_count, health, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as RecipeListRow[]).map(normalizeListRow);
}

/** Détail d'une recette + ses ingrédients enrichis (drift par ligne). */
export async function fetchRecipeDetail(id: string): Promise<RecipeDetail | null> {
  const { data: header, error: hErr } = await supabase
    .from("recipes_with_health")
    .select(
      "id, name, selling_price, vat_rate, notes, current_cost_ht, current_margin_pct, cost_drift_pct, baseline_cost_ht, baseline_recorded_at, has_unpriced_items, items_count, health, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (hErr || !header) return null;

  const { data: items, error: iErr } = await supabase
    .from("recipe_ingredients_with_drift")
    .select(
      "id, recipe_id, product_id, label, quantity, unit, quantity_unit, product_unit, manual_price_ht, baseline_price_ht, position, current_price_ht, current_price_recorded_at, current_subtotal_ht, price_drift_pct",
    )
    .eq("recipe_id", id)
    .order("position", { ascending: true });
  if (iErr) return null;

  return {
    ...normalizeListRow(header as unknown as RecipeListRow),
    notes: ((header as unknown) as { notes: string | null }).notes,
    ingredients: ((items ?? []) as unknown as RecipeIngredientRow[]).map(normalizeIngredient),
  };
}

/** Compte les recettes critiques pour le widget "Santé de votre Carte". */
export async function fetchRecipesHealth(): Promise<{
  total: number;
  critical: number;
  warning: number;
}> {
  const { data } = await supabase
    .from("recipes_with_health")
    .select("health")
    .not("health", "is", null);
  const rows = (data ?? []) as { health: RecipeHealth }[];
  let critical = 0;
  let warning = 0;
  for (const r of rows) {
    if (r.health === "critical") critical++;
    else if (r.health === "warning") warning++;
  }
  return { total: rows.length, critical, warning };
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export type IngredientInput = {
  productId: string | null;
  label: string;
  unit: string;          // legacy column
  quantity: number;
  quantityUnit: string;
  productUnit: string;
  manualPriceHt: number | null;
  baselinePriceHt: number | null;
};

export type RecipeInput = {
  name: string;
  sellingPriceTtc: number | null;
  vatRate: number;
  notes?: string | null;
  ingredients: IngredientInput[];
};

/**
 * Crée une recette + ses ingrédients en bulk. Calcule la baseline (coût matière
 * au moment de la sauvegarde) côté client à partir des prix utilisés — pas de
 * round-trip après l'insert pour relire la vue.
 *
 * Lazy-create du restaurant si l'user n'en a pas encore (cas d'un nouveau
 * compte qui crée sa 1ère recette avant son 1er scan). Le nom du restaurant
 * vient de profiles.restaurant_name (saisi à l'onboarding) ou d'un fallback.
 *
 * Throw une `Error` avec un message lisible si l'insert échoue — le caller
 * (FlashCalculator) l'affiche tel quel dans la modal.
 */
export async function createRecipe(input: RecipeInput): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expirée");
  const userId = session.user.id;

  // 1. Récupère ou crée le restaurant. NB : pas de colonne vat_rate sur cette
  //    table (la TVA vit sur recipes), donc on ne sélectionne que id.
  let restaurantId: string | undefined;
  const { data: existing, error: lookupErr } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (lookupErr) throw new Error(`Lecture restaurant impossible : ${lookupErr.message}`);
  restaurantId = (existing as { id?: string } | null)?.id;

  if (!restaurantId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_name")
      .eq("id", userId)
      .maybeSingle();
    const restName = ((profile as { restaurant_name?: string } | null)?.restaurant_name ?? "").trim() || "Mon restaurant";
    const { data: newRest, error: createErr } = await supabase
      .from("restaurants")
      .insert({ owner_id: userId, name: restName })
      .select("id")
      .single();
    if (createErr || !newRest) {
      throw new Error(`Création restaurant impossible : ${createErr?.message ?? "réponse vide"}`);
    }
    restaurantId = (newRest as { id: string }).id;
  }

  // 2. Baseline = somme des sous-totaux à la date du save, avec conversion d'unités.
  const baselineCostHt = computeBaseline(input.ingredients);

  const { data: recipeRow, error: rErr } = await supabase
    .from("recipes")
    .insert({
      restaurant_id: restaurantId,
      name: input.name,
      selling_price: input.sellingPriceTtc,
      vat_rate: input.vatRate,
      notes: input.notes ?? null,
      baseline_cost_ht: baselineCostHt,
      baseline_recorded_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (rErr || !recipeRow) {
    throw new Error(`Insert recette : ${rErr?.message ?? "réponse vide"} — vérifiez que la migration 014 est bien appliquée.`);
  }
  const recipeId = (recipeRow as { id: string }).id;

  if (input.ingredients.length > 0) {
    const { error: iErr } = await supabase
      .from("recipe_ingredients")
      .insert(input.ingredients.map((ing, idx) => ({
        recipe_id: recipeId,
        product_id: ing.productId,
        label: ing.label,
        quantity: ing.quantity,
        unit: ing.unit || ing.productUnit || ing.quantityUnit || "u",
        quantity_unit: ing.quantityUnit || ing.productUnit || ing.unit || "u",
        product_unit: ing.productUnit || ing.unit || ing.quantityUnit || "u",
        manual_price_ht: ing.manualPriceHt,
        baseline_price_ht: ing.baselinePriceHt,
        position: idx,
      })));
    if (iErr) {
      // Rollback best-effort : on supprime la recette si les ingrédients ont
      // échoué (RLS owner_recipes autorise le delete, on est sur la même session).
      await supabase.from("recipes").delete().eq("id", recipeId);
      throw new Error(`Insert ingrédients : ${iErr.message}`);
    }
  }
  return recipeId;
}

/** Met à jour le prix de vente cible. */
export async function updateRecipeSellingPrice(
  id: string,
  sellingPriceTtc: number | null,
  vatRate: number,
): Promise<boolean> {
  const { error } = await supabase
    .from("recipes")
    .update({ selling_price: sellingPriceTtc, vat_rate: vatRate })
    .eq("id", id);
  return !error;
}

/** Met à jour la quantité d'un ingrédient (utilisé par l'ajustement de portion). */
export async function updateIngredientQuantity(
  id: string,
  quantity: number,
): Promise<boolean> {
  const { error } = await supabase
    .from("recipe_ingredients")
    .update({ quantity })
    .eq("id", id);
  return !error;
}

/** Saisie manuelle d'un prix de secours (produit jamais scanné). */
export async function updateIngredientManualPrice(
  id: string,
  manualPriceHt: number | null,
): Promise<boolean> {
  const { error } = await supabase
    .from("recipe_ingredients")
    .update({ manual_price_ht: manualPriceHt })
    .eq("id", id);
  return !error;
}

/** Réaligne le baseline_cost_ht sur le coût courant (= "ack" la dérive). */
export async function rebaselineRecipe(id: string): Promise<boolean> {
  // On lit le current_cost depuis la vue, puis on l'écrit comme nouveau baseline.
  const { data } = await supabase
    .from("recipes_with_health")
    .select("current_cost_ht")
    .eq("id", id)
    .maybeSingle();
  const current = (data as { current_cost_ht?: number } | null)?.current_cost_ht ?? 0;
  const { error } = await supabase
    .from("recipes")
    .update({
      baseline_cost_ht: current,
      baseline_recorded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return false;
  // On rafraîchit aussi les baseline_price_ht des ingrédients = prix courant.
  const { data: items } = await supabase
    .from("recipe_ingredients_with_drift")
    .select("id, current_price_ht")
    .eq("recipe_id", id);
  for (const it of (items ?? []) as { id: string; current_price_ht: number | null }[]) {
    if (it.current_price_ht != null) {
      await supabase
        .from("recipe_ingredients")
        .update({ baseline_price_ht: it.current_price_ht })
        .eq("id", it.id);
    }
  }
  return true;
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  return !error;
}

/**
 * Pour la recette `recipeId`, compte le nombre d'AUTRES recettes qui utilisent
 * le même product_id pour chaque ingrédient. Permet d'afficher
 * "Utilisé dans X autres recettes" — quand le prix du beurre monte, le chef
 * voit en un clin d'œil que son drift va se propager sur N plats.
 *
 * Retourne une map { product_id -> count of OTHER recipes }. Les ingrédients
 * sans product_id (saisis à la main) ne sont pas comptés.
 *
 * 1 requête, agrégation côté client — suffisant tant que la BDD est petite.
 */
export async function fetchProductUsageInOtherRecipes(
  recipeId: string,
  productIds: string[],
): Promise<Record<string, number>> {
  const ids = productIds.filter((p): p is string => !!p);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, product_id")
    .in("product_id", ids)
    .neq("recipe_id", recipeId);
  if (error || !data) return {};
  type Row = { recipe_id: string; product_id: string };
  const map: Record<string, Set<string>> = {};
  for (const r of data as unknown as Row[]) {
    if (!r.product_id) continue;
    if (!map[r.product_id]) map[r.product_id] = new Set();
    map[r.product_id].add(r.recipe_id);
  }
  const result: Record<string, number> = {};
  for (const pid of ids) result[pid] = map[pid]?.size ?? 0;
  return result;
}

// ─── Helpers de calcul (miroir client de la fonction SQL) ────────────────────

const TO_FACTOR_KG: Record<string, number> = { kg: 1, g: 0.001 };
const TO_FACTOR_L: Record<string, number> = { l: 1, cl: 0.01, ml: 0.001 };

/** Doit rester aligné avec public.unit_conversion_factor() côté SQL. */
export function unitConversionFactor(fromUnit: string, toUnit: string): number {
  const f = (fromUnit || "").toLowerCase();
  const t = (toUnit || "").toLowerCase();
  if (f === t) return 1;
  if (f in TO_FACTOR_KG && t in TO_FACTOR_KG) return TO_FACTOR_KG[f] / TO_FACTOR_KG[t];
  if (f in TO_FACTOR_L && t in TO_FACTOR_L) return TO_FACTOR_L[f] / TO_FACTOR_L[t];
  return 1;
}

function computeBaseline(items: IngredientInput[]): number {
  let total = 0;
  for (const it of items) {
    const price = it.manualPriceHt ?? it.baselinePriceHt;
    if (price == null) continue;
    const factor = unitConversionFactor(
      it.quantityUnit || it.productUnit,
      it.productUnit || it.quantityUnit,
    );
    total += price * it.quantity * factor;
  }
  return Math.round(total * 10000) / 10000;
}

function normalizeListRow(r: RecipeListRow): RecipeListRow {
  return {
    ...r,
    selling_price: r.selling_price == null ? null : Number(r.selling_price),
    vat_rate: r.vat_rate == null ? null : Number(r.vat_rate),
    current_cost_ht: Number(r.current_cost_ht ?? 0),
    current_margin_pct: r.current_margin_pct == null ? null : Number(r.current_margin_pct),
    cost_drift_pct: r.cost_drift_pct == null ? null : Number(r.cost_drift_pct),
    baseline_cost_ht: Number(r.baseline_cost_ht ?? 0),
    items_count: Number(r.items_count ?? 0),
  };
}
function normalizeIngredient(r: RecipeIngredientRow): RecipeIngredientRow {
  return {
    ...r,
    quantity: Number(r.quantity),
    manual_price_ht: r.manual_price_ht == null ? null : Number(r.manual_price_ht),
    baseline_price_ht: r.baseline_price_ht == null ? null : Number(r.baseline_price_ht),
    current_price_ht: r.current_price_ht == null ? null : Number(r.current_price_ht),
    current_subtotal_ht: Number(r.current_subtotal_ht ?? 0),
    price_drift_pct: r.price_drift_pct == null ? null : Number(r.price_drift_pct),
  };
}
