// Supabase Edge Function — MargeChef
// Orchestrateur : image → Claude Vision → analyse prix → alertes marge
// Runtime : Deno (Supabase Edge Runtime)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.54.0";

// ─── Config ──────────────────────────────────────────────
const PRICE_ALERT_THRESHOLD_PCT = 3;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// ─── Types ────────────────────────────────────────────────
interface ExtractedItem {
  raw_label: string;
  reference_code?: string | null;
  quantity: number;
  unit: string;
  unit_price_ht: number;
  total_price_ht: number;
  vat_rate: number;
}

interface ExtractedInvoice {
  supplier_name: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  items: ExtractedItem[];
  extraction_confidence: "high" | "medium" | "low";
  extraction_notes?: string | null;
}

interface AffectedRecipe {
  id: string;
  name: string;
  margin_impact_pts: number;
}

// ─── Claude Vision Prompt ─────────────────────────────────
const EXTRACTION_PROMPT = `Tu es un assistant spécialisé dans l'analyse de factures de restauration française.

Analyse cette facture fournisseur et extrais les informations suivantes au format JSON strict.

RÈGLES D'EXTRACTION :
- Les prix sont TOUJOURS en euros HT (hors taxe)
- Si un prix semble TTC, convertis-le en HT avec le taux de TVA identifié
- Les taux de TVA alimentaires en France : 0%, 5.5% (produits bruts), 10% (plats préparés), 20% (alcool)
- Normalise les unités : kg, g, L, cL, mL, pièce, barquette, carton, bouteille, sachet, botte, filet, plateau, unité
- Si une ligne est illisible, inclus-la quand même avec les champs disponibles
- invoice_date doit être au format ISO 8601 (YYYY-MM-DD)
- extraction_confidence : "high" si tout est lisible, "medium" si quelques zones floues, "low" si image dégradée

RETOURNE UNIQUEMENT CE JSON (sans markdown, sans explication) :
{
  "supplier_name": "string",
  "invoice_number": "string | null",
  "invoice_date": "string | null",
  "items": [
    {
      "raw_label": "string",
      "reference_code": "string | null",
      "quantity": number,
      "unit": "string",
      "unit_price_ht": number,
      "total_price_ht": number,
      "vat_rate": number
    }
  ],
  "extraction_confidence": "high" | "medium" | "low",
  "extraction_notes": "string | null"
}`;

// ─── Helpers ──────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function parseClaudeResponse(raw: string): ExtractedInvoice {
  const cleaned = raw
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  let parsed: ExtractedInvoice;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude response non parseable : ${cleaned.slice(0, 200)}`);
  }

  if (!parsed.supplier_name || !Array.isArray(parsed.items)) {
    throw new Error("Structure JSON invalide — champs obligatoires manquants");
  }

  parsed.items = parsed.items.map((item) => ({
    ...item,
    quantity: Number(item.quantity) || 0,
    unit_price_ht: Number(item.unit_price_ht) || 0,
    total_price_ht: Number(item.total_price_ht) || 0,
    vat_rate: Number(item.vat_rate) ?? 5.5,
  }));

  return parsed;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

async function upsertSupplier(
  sb: SupabaseClient,
  restaurantId: string,
  name: string
): Promise<string> {
  const { data: existing } = await sb
    .from("suppliers")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .ilike("name", name)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await sb
    .from("suppliers")
    .insert({ restaurant_id: restaurantId, name })
    .select("id")
    .single();

  if (error) throw new Error(`Erreur création fournisseur : ${error.message}`);
  return data.id;
}

async function upsertProduct(
  sb: SupabaseClient,
  restaurantId: string,
  supplierId: string,
  item: ExtractedItem
): Promise<{ productId: string; wasCreated: boolean }> {
  const query = item.reference_code
    ? sb
        .from("products")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("reference_code", item.reference_code)
        .maybeSingle()
    : sb
        .from("products")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .ilike("name", item.raw_label)
        .maybeSingle();

  const { data: existing } = await query;
  if (existing) return { productId: existing.id, wasCreated: false };

  const { data, error } = await sb
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
  sb: SupabaseClient,
  productId: string
): Promise<number | null> {
  const { data } = await sb
    .from("price_history")
    .select("price_ht")
    .eq("product_id", productId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.price_ht ?? null;
}

async function getAffectedRecipes(
  sb: SupabaseClient,
  productId: string,
  oldPrice: number,
  newPrice: number
): Promise<AffectedRecipe[]> {
  const { data: usages } = await sb
    .from("recipe_ingredients")
    .select(`quantity, recipe:recipes(id, name, selling_price, vat_rate)`)
    .eq("product_id", productId);

  if (!usages?.length) return [];

  return usages
    .filter((u: { recipe: unknown }) => u.recipe)
    .map((u: { quantity: number; recipe: { id: string; name: string; selling_price: number; vat_rate: number } }) => {
      const recipe = u.recipe;
      const sellingPriceHt = recipe.selling_price / (1 + recipe.vat_rate / 100);
      const extraCost = (newPrice - oldPrice) * u.quantity;
      const impactPts = sellingPriceHt > 0
        ? Math.round((extraCost / sellingPriceHt) * 10000) / 100
        : 0;
      return { id: recipe.id, name: recipe.name, margin_impact_pts: impactPts };
    });
}

// ─── Main pipeline ────────────────────────────────────────
async function processInvoice(
  sb: SupabaseClient,
  restaurantId: string,
  invoiceId: string,
  extracted: ExtractedInvoice
) {
  const supplierId = await upsertSupplier(sb, restaurantId, extracted.supplier_name);

  // Mise à jour métadonnées facture
  await sb.from("invoices").update({
    supplier_id: supplierId,
    invoice_date: extracted.invoice_date,
    invoice_number: extracted.invoice_number,
    raw_ai_response: extracted,
    status: "processed",
  }).eq("id", invoiceId);

  let itemsMatched = 0, itemsCreated = 0;
  const alerts = [];

  for (const item of extracted.items) {
    const { productId, wasCreated } = await upsertProduct(
      sb, restaurantId, supplierId, item
    );
    wasCreated ? itemsCreated++ : itemsMatched++;

    const previousPrice = await getLastPrice(sb, productId);

    // Enregistre le prix
    await sb.from("price_history").insert({
      product_id: productId,
      price_ht: item.unit_price_ht,
      invoice_id: invoiceId,
      source: "invoice",
    });

    // Ligne de facture
    await sb.from("invoice_items").insert({
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

    // Alerte si variation significative
    if (previousPrice !== null) {
      const changePct = ((item.unit_price_ht - previousPrice) / previousPrice) * 100;

      if (Math.abs(changePct) >= PRICE_ALERT_THRESHOLD_PCT) {
        const affectedRecipes = await getAffectedRecipes(
          sb, productId, previousPrice, item.unit_price_ht
        );

        await sb.from("margin_alerts").insert({
          restaurant_id: restaurantId,
          product_id: productId,
          invoice_id: invoiceId,
          old_price: previousPrice,
          new_price: item.unit_price_ht,
          price_change_pct: Math.round(changePct * 100) / 100,
          affected_recipes: affectedRecipes,
          is_read: false,
        });

        alerts.push({
          product_name: item.raw_label,
          old_price: previousPrice,
          new_price: item.unit_price_ht,
          price_change_pct: Math.round(changePct * 100) / 100,
          affected_recipes: affectedRecipes,
        });
      }
    }
  }

  return { invoice_id: invoiceId, extracted, items_matched: itemsMatched, items_created: itemsCreated, alerts };
}

// ─── Entry point ──────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id requis" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

    // Client service-role pour les opérations DB
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Vérification ownership via le token utilisateur
    const userSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await userSb.auth.getUser();
    if (authErr || !user) return json({ error: "Token invalide" }, 401);

    // Récupère la facture et vérifie l'ownership
    const { data: invoice, error: invErr } = await sb
      .from("invoices")
      .select("*, restaurant:restaurants(id, owner_id)")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) return json({ error: "Facture introuvable" }, 404);
    if (invoice.restaurant.owner_id !== user.id) return json({ error: "Accès refusé" }, 403);
    if (invoice.status === "processed") return json({ error: "Déjà traitée" }, 409);

    // Passe en "processing"
    await sb.from("invoices").update({ status: "processing" }).eq("id", invoice_id);

    // Téléchargement de l'image depuis Storage
    const { data: imageBlob, error: dlErr } = await sb.storage
      .from("invoices")
      .download(invoice.image_path);

    if (dlErr || !imageBlob) {
      await sb.from("invoices").update({ status: "error" }).eq("id", invoice_id);
      return json({ error: "Image introuvable dans Storage" }, 404);
    }

    // Conversion base64
    const arrayBuffer = await imageBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const ext = invoice.image_path.split(".").pop()?.toLowerCase() ?? "jpg";
    const mediaType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    // Claude Vision
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const claudeResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      }],
    });

    const rawText = claudeResponse.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    let extracted: ExtractedInvoice;
    try {
      extracted = parseClaudeResponse(rawText);
    } catch (err) {
      await sb.from("invoices").update({ status: "error" }).eq("id", invoice_id);
      return json({ error: "Échec parsing Claude", details: String(err) }, 422);
    }

    // Pipeline complet
    const result = await processInvoice(sb, invoice.restaurant.id, invoice_id, extracted);

    return json(result, 200);

  } catch (err) {
    console.error("[process-invoice] Fatal:", err);
    return json({ error: "Erreur interne", details: String(err) }, 500);
  }
});
