import { createClient } from "@supabase/supabase-js";
import type {
  ExtractedInvoice,
  ExtractedItem,
  PriceChangeAlert,
  AffectedRecipe,
  ProcessInvoiceResult,
} from "@/types/invoice";

const PRICE_ALERT_THRESHOLD_PCT = 3; // alerte si variation > 3%

export async function processExtractedInvoice(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  invoiceId: string,
  extracted: ExtractedInvoice
): Promise<ProcessInvoiceResult> {
  // 1. Mise à jour du statut et des métadonnées de la facture
  const supplierId = await upsertSupplier(supabase, restaurantId, extracted.supplier_name);

  await supabase
    .from("invoices")
    // @ts-ignore
    .update({
      supplier_id: supplierId,
      invoice_date: extracted.invoice_date,
      invoice_number: extracted.invoice_number,
      raw_ai_response: extracted,
      status: "processed",
    })
    .eq("id", invoiceId);

  // 2. Traitement de chaque ligne extraite
  const alerts: PriceChangeAlert[] = [];
  let itemsMatched = 0;
  let itemsCreated = 0;

  for (const item of extracted.items) {
    const { productId, wasCreated } = await upsertProduct(
      supabase,
      restaurantId,
      supplierId,
      item
    );

    if (wasCreated) {
      itemsCreated++;
    } else {
      itemsMatched++;
    }

    // 3. Récupère le dernier prix connu avant ce scan
    const previousPrice = await getLastPrice(supabase, productId);

    // 4. Enregistre le nouveau prix
    await supabase.from("price_history").insert({
      product_id: productId,
      price_ht: item.unit_price_ht,
      invoice_id: invoiceId,
      source: "invoice",
    });

    // 5. Insère la ligne de facture
    await supabase.from("invoice_items").insert({
      invoice_id: invoiceId,
      product_id: productId,
      raw_label: item.raw_label,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_ht: item.unit_price_ht,
      total_price_ht: item.total_price_ht,
      vat_rate: item.vat_rate,
      matched: !wasCreated,
    });

    // 6. Calcule et génère l'alerte si nécessaire
    if (previousPrice !== null) {
      const changePct = ((item.unit_price_ht - previousPrice) / previousPrice) * 100;

      if (Math.abs(changePct) >= PRICE_ALERT_THRESHOLD_PCT) {
        const affectedRecipes = await getAffectedRecipes(
          supabase,
          restaurantId,
          productId,
          previousPrice,
          item.unit_price_ht
        );

        const alert = await createMarginAlert(supabase, {
          restaurantId,
          productId,
          invoiceId,
          oldPrice: previousPrice,
          newPrice: item.unit_price_ht,
          changePct,
          affectedRecipes,
        });

        alerts.push({
          product_id: productId,
          product_name: item.raw_label,
          old_price: previousPrice,
          new_price: item.unit_price_ht,
          price_change_pct: changePct,
          affected_recipes: affectedRecipes,
        });
      }
    }
  }

  return {
    invoice_id: invoiceId,
    extracted,
    items_matched: itemsMatched,
    items_created: itemsCreated,
    alerts,
  };
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

async function upsertSupplier(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  supplierName: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .ilike("name", supplierName)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ restaurant_id: restaurantId, name: supplierName })
    .select("id")
    .single();

  if (error) throw new Error(`Erreur création fournisseur : ${error.message}`);
  return data.id;
}

async function upsertProduct(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  supplierId: string,
  item: ExtractedItem
): Promise<{ productId: string; wasCreated: boolean }> {
  // Recherche par code référence d'abord, puis par nom approché
  const query = item.reference_code
    ? supabase
        .from("products")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("reference_code", item.reference_code)
        .maybeSingle()
    : supabase
        .from("products")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .ilike("name", item.raw_label)
        .maybeSingle();

  const { data: existing } = await query;

  if (existing) {
    return { productId: existing.id, wasCreated: false };
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      name: item.raw_label,
      unit: item.unit,
      reference_code: item.reference_code ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Erreur création produit : ${error.message}`);
  return { productId: data.id, wasCreated: true };
}

async function getLastPrice(
  supabase: ReturnType<typeof createClient>,
  productId: string
): Promise<number | null> {
  const { data } = await supabase
    .from("price_history")
    .select("price_ht")
    .eq("product_id", productId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.price_ht ?? null;
}

async function getAffectedRecipes(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  productId: string,
  oldPrice: number,
  newPrice: number
): Promise<AffectedRecipe[]> {
  // Récupère toutes les recettes qui utilisent ce produit
  const { data: usages } = await supabase
    .from("recipe_ingredients")
    .select(`
      quantity,
      unit,
      recipe:recipes (
        id,
        name,
        selling_price,
        vat_rate,
        portions
      )
    `)
    .eq("product_id", productId);

  if (!usages || usages.length === 0) return [];

  return usages
    .filter((u) => u.recipe)
    .map((u) => {
      const recipe = u.recipe as {
        id: string;
        name: string;
        selling_price: number;
        vat_rate: number;
        portions: number;
      };

      const sellingPriceHt = recipe.selling_price / (1 + recipe.vat_rate / 100);
      const extraCost = (newPrice - oldPrice) * u.quantity;
      const marginImpactPts = sellingPriceHt > 0
        ? (extraCost / sellingPriceHt) * 100
        : 0;

      return {
        id: recipe.id,
        name: recipe.name,
        margin_impact_pts: Math.round(marginImpactPts * 100) / 100,
      };
    });
}

async function createMarginAlert(
  supabase: ReturnType<typeof createClient>,
  params: {
    restaurantId: string;
    productId: string;
    invoiceId: string;
    oldPrice: number;
    newPrice: number;
    changePct: number;
    affectedRecipes: AffectedRecipe[];
  }
) {
  await supabase.from("margin_alerts").insert({
    restaurant_id: params.restaurantId,
    product_id: params.productId,
    invoice_id: params.invoiceId,
    old_price: params.oldPrice,
    new_price: params.newPrice,
    price_change_pct: Math.round(params.changePct * 100) / 100,
    affected_recipes: params.affectedRecipes,
    is_read: false,
  });
}
