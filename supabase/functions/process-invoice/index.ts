// Supabase Edge Function — MargeChef
// Orchestrateur : image → Claude Vision → analyse prix → alertes marge
// Runtime : Deno (Supabase Edge Runtime)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.54.0";

// ─── Config ──────────────────────────────────────────────
// Seuil au-delà duquel une variation de prix produit déclenche une alerte.
// 3% générait trop de bruit (saisonnalité produits frais) → 7% capture les
// vraies hausses fournisseur sans noyer le chef.
const PRICE_ALERT_THRESHOLD_PCT = 7;

// Fix audit C6 — garde-fou anti-hallucination IA sur les prix extraits
const SANITY_PRICE_RANGE = { min: 0.01, max: 1000 } as const;

// CORS restreint à la prod (le edge est appelé server-to-server depuis
// /api/invoices/process, donc cross-origin browser est inutile en pratique).
const ALLOWED_ORIGIN = "https://www.yieldapp.fr";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
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
  needs_review?: boolean;
  // Fix audit C6 — raisons cumulées du flag needs_review, séparées par "|"
  // (ex: "drift_mismatch", "price_out_of_range", "drift_mismatch|price_out_of_range")
  review_reason?: string;
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
//
// Concentré sur l'extraction JSON structurée. Inclut une section ENCODAGE
// qui force UTF-8 propre côté sortie : sans elle, on a vu remonter des
// apostrophes typographiques (’) et espaces insécables ( ) qui cassaient
// la troncature et rendaient les libellés mal alignés dans le PDF
// @react-pdf/renderer (qui ne porte pas tous les glyphes Unicode étendus).
const EXTRACTION_PROMPT = `Tu es un assistant spécialisé dans l'analyse de factures de restauration française.
Ton SEUL job : produire un JSON strict, parseable, fidèle à la facture.

PRÉTRAITEMENT (à faire mentalement avant l'extraction) :
- Si la facture est inclinée ou photographiée de biais, redresse-la mentalement (perspective) avant de lire.
- Si une zone est sombre ou floue à cause d'une mauvaise lumière, augmente mentalement le contraste localement pour décoder les chiffres.
- Si une ligne est barrée ou rayée à la main, ignore-la (c'est une correction du fournisseur).
- Si tu vois une signature, un tampon ou une note manuscrite par-dessus une ligne, lis quand même la ligne d'origine en dessous.
- Si l'image est partiellement coupée (un bord manque), extrais quand même ce qui est visible et signale-le dans extraction_notes.

ENCODAGE & CARACTÈRES SPÉCIAUX (CRITIQUE pour le PDF en aval) :
- Sortie en UTF-8 strict. Conserve les accents français : à, â, ä, é, è, ê, ë, î, ï, ô, ö, ù, û, ü, ÿ, ç.
- Conserve les ligatures : œ (oeuf, bœuf, cœur), Œ, æ, Æ. NE PAS les remplacer par "oe" ou "ae".
- Convertis les apostrophes typographiques (’ ‘) en apostrophe droite ASCII (').
- Convertis les guillemets typographiques (“ ”) en guillemets droits ASCII (").
- Remplace les espaces insécables (U+00A0) par des espaces normaux.
- Remplace les tirets cadratins (— –) par des tirets simples (-) dans les libellés.
- Pour les prix : les valeurs numériques (unit_price_ht, total_price_ht, vat_rate) doivent être des nombres JSON, JAMAIS des chaînes. Le symbole € NE DOIT PAS apparaître — c'est un nombre. Convertis "1,25 €" et "1.25 EUR" et "1,25€" en 1.25.
- Pour la quantité : nombre JSON. "1,5 kg" → quantity=1.5, unit="kg". Évite les fractions Unicode (½ ¼) — convertis en décimales.

RÈGLES D'EXTRACTION :
- Les prix sont TOUJOURS en euros HT (hors taxe). Si un prix est annoncé TTC, convertis-le en HT avec le taux de TVA identifié.
- Taux de TVA alimentaires en France : 0%, 5.5 (produits bruts), 10 (plats préparés), 20 (alcool). Toujours en nombre, sans le symbole %.
- Normalise les unités à l'une de : kg, g, L, cL, mL, piece, barquette, carton, bouteille, sachet, botte, filet, plateau, unite (sans accents pour l'unité — le frontend les ré-affiche en français propre).
- Si une ligne est illisible, inclus-la quand même : raw_label = ce que tu vois (peut être tronqué), unit_price_ht et total_price_ht à 0, et signale-le dans extraction_notes.
- invoice_date au format ISO 8601 strict (YYYY-MM-DD). Si la date est ambiguë (jour/mois inversés), choisis l'interprétation française (DD/MM/YYYY) et signale dans extraction_notes.
- extraction_confidence : "high" si tout est lisible, "medium" si quelques zones floues, "low" si image dégradée.

FORMAT DE RÉPONSE — RÈGLE STRICTE :
- Retourne UNIQUEMENT le JSON, RIEN d'autre.
- PAS de bloc \`\`\`json … \`\`\`. PAS de texte avant ou après. PAS de commentaires // ni /* */.
- Toutes les chaînes doivent être correctement échappées (guillemets internes en \\", retours ligne en \\n).
- Si un champ est inconnu, mets null (pas "N/A", pas "" en string).

SCHÉMA :
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

  parsed.items = parsed.items.map((item) => {
    let quantity = Number(item.quantity) || 0;
    let unit_price_ht = Number(item.unit_price_ht) || 0;
    let total_price_ht = Number(item.total_price_ht) || 0;

    // ─── Normalisation : recomposer le champ manquant si les 2 autres sont
    // présents. Cas courant : facture fromager qui n'affiche que "1,5 kg + total
    // 15,30 €" sans prix au kg → on calcule unit_price = 10,20 €. Sans cette
    // étape, on stockait quantity ou unit_price à 0 et l'historique de prix
    // était corrompu (alertes futures à -100% / +∞).
    if (quantity === 0 && unit_price_ht > 0 && total_price_ht > 0) {
      quantity = total_price_ht / unit_price_ht;
    } else if (unit_price_ht === 0 && quantity > 0 && total_price_ht > 0) {
      unit_price_ht = total_price_ht / quantity;
    } else if (total_price_ht === 0 && quantity > 0 && unit_price_ht > 0) {
      total_price_ht = quantity * unit_price_ht;
    }

    // Sanity check : si unit_price × quantity diverge de >5% du total annoncé,
    // l'IA a probablement halluciné un champ. On flag pour revue manuelle au
    // lieu de propager un prix faussé dans price_history (qui pollue les
    // graphiques à vie). Par construction la normalisation ci-dessus donne
    // drift = 0, donc needs_review=false sur les lignes reconstruites.
    const expected = unit_price_ht * quantity;
    const drift = total_price_ht > 0
      ? Math.abs(expected - total_price_ht) / total_price_ht
      : 0;

    // Fix audit C6 — cumul des raisons de flag dans un array temporaire, puis
    // sérialisation en string "|"-séparée pour rester compatible avec le typage
    // existant (review_reason?: string) sans introduire de structure plus lourde.
    // TODO audit: l'UI ne gère pas encore l'affichage des items needs_review —
    // à traiter dans un fix UX séparé (afficher les lignes à valider dans la
    // page détail facture, permettre au chef de corriger ou rejeter).
    const reasons: string[] = [];
    if (drift > 0.05) reasons.push("drift_mismatch");
    if (unit_price_ht < SANITY_PRICE_RANGE.min || unit_price_ht > SANITY_PRICE_RANGE.max) {
      reasons.push("price_out_of_range");
    }

    return {
      ...item,
      quantity,
      unit_price_ht,
      total_price_ht,
      vat_rate: Number(item.vat_rate) ?? 5.5,
      needs_review: reasons.length > 0,
      review_reason: reasons.length > 0 ? reasons.join("|") : undefined,
    };
  });

  return parsed;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * Libère le slot de quota réservé en amont (`/api/invoices/process` a appelé
 * `check_and_increment_scan_usage` AVANT de fire l'edge function).
 *
 * Appelée quand le scan ne produit pas de valeur pour le user :
 *   - status='error' (parsing Claude raté, crash mid-pipeline)
 *   - status='duplicate' (BL déjà importé)
 *
 * Best-effort : si l'appel échoue, on log mais on ne propage pas — laisser le
 * compteur à +1 vaut mieux que faire crasher la response handler.
 */
async function releaseQuotaSlot(sb: SupabaseClient, restaurantId: string): Promise<void> {
  try {
    await sb.rpc("decrement_scan_usage", { p_restaurant_id: restaurantId });
  } catch (e) {
    console.error("[process-invoice] decrement_scan_usage failed:", e);
  }
}

/**
 * Marque une facture en erreur ET stocke le message user-facing dans
 * `invoices.error_message` pour que le polling client le propage au chef.
 * Best-effort : si l'update échoue, on log mais on ne propage pas (la
 * réponse HTTP courante reste autoritaire).
 */
async function markInvoiceError(
  sb: SupabaseClient,
  id: string,
  message: string,
): Promise<void> {
  try {
    await sb.from("invoices").update({
      status: "error",
      error_message: message,
    }).eq("id", id);
  } catch (e) {
    console.error("[process-invoice] markInvoiceError failed:", e);
  }
}

type FileKind = { kind: "pdf" | "image"; mediaType: string };

/**
 * Détecte le type de fichier de manière robuste, dans l'ordre de fiabilité :
 *   1. content_type fourni par le navigateur lors de l'upload (file.type)
 *   2. Magic-byte detection (premiers octets du blob — résiste à un
 *      Content-Type vide ou tordu)
 *   3. Extension du filename (dernier recours)
 *
 * Pour les PDFs Google Docs / exports navigateur, le content_type peut être
 * absent ou erroné — la magic-byte detection garantit la bonne classification.
 */
function detectFileKind(
  contentType: string | null,
  bytes: Uint8Array,
  imagePath: string,
): FileKind {
  // 1. content_type (le plus fiable quand le navigateur l'envoie)
  switch (contentType) {
    case "application/pdf": return { kind: "pdf", mediaType: "application/pdf" };
    case "image/png":       return { kind: "image", mediaType: "image/png" };
    case "image/webp":      return { kind: "image", mediaType: "image/webp" };
    case "image/gif":       return { kind: "image", mediaType: "image/gif" };
    case "image/jpeg":
    case "image/jpg":       return { kind: "image", mediaType: "image/jpeg" };
  }

  // 2. Magic-byte detection sur les premiers octets
  if (bytes.length >= 4) {
    // PDF : %PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { kind: "pdf", mediaType: "application/pdf" };
    }
    // PNG : 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return { kind: "image", mediaType: "image/png" };
    }
    // JPEG : FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return { kind: "image", mediaType: "image/jpeg" };
    }
    // GIF : 47 49 46 38 (GIF8)
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return { kind: "image", mediaType: "image/gif" };
    }
    // WebP : RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return { kind: "image", mediaType: "image/webp" };
    }
  }

  // 3. Extension du filename (dernier recours, peu fiable)
  const ext = imagePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")  return { kind: "pdf",   mediaType: "application/pdf" };
  if (ext === "png")  return { kind: "image", mediaType: "image/png" };
  if (ext === "webp") return { kind: "image", mediaType: "image/webp" };
  if (ext === "gif")  return { kind: "image", mediaType: "image/gif" };
  return { kind: "image", mediaType: "image/jpeg" };
}

const PDF_UNSUPPORTED_MSG =
  "Ce format PDF n'est pas supporté, veuillez utiliser une photo ou un PDF image.";
const IMAGE_UNREADABLE_MSG =
  "Lecture impossible — réessayez avec une photo plus nette.";

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
class DuplicateInvoiceError extends Error {
  existingInvoiceId: string;
  constructor(existingInvoiceId: string) {
    super("Duplicate invoice");
    this.existingInvoiceId = existingInvoiceId;
  }
}

async function processInvoice(
  sb: SupabaseClient,
  restaurantId: string,
  invoiceId: string,
  extracted: ExtractedInvoice
) {
  const supplierId = await upsertSupplier(sb, restaurantId, extracted.supplier_name);

  // Détection doublon AVANT le pipeline (sinon on insère prix/items en double).
  // L'unique index uniq_invoice_per_supplier ne couvre que les BL avec
  // supplier_id ET invoice_number renseignés.
  if (extracted.invoice_number) {
    const { data: existing } = await sb
      .from("invoices")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("supplier_id", supplierId)
      .eq("invoice_number", extracted.invoice_number)
      .neq("id", invoiceId)
      .maybeSingle();

    if (existing) {
      await sb.from("invoices")
        .update({ status: "duplicate", supplier_id: supplierId, raw_ai_response: extracted })
        .eq("id", invoiceId);
      throw new DuplicateInvoiceError(existing.id);
    }
  }

  // ─── Phase MATCHING ───
  // Update partiel des métadonnées + processing_step + total_items_count.
  // Permet au client de polling d'afficher "Analyse des 12 produits..."
  await sb.from("invoices").update({
    supplier_id: supplierId,
    invoice_date: extracted.invoice_date,
    invoice_number: extracted.invoice_number,
    raw_ai_response: extracted,
    total_items_count: extracted.items.length,
    processing_step: "matching",
  }).eq("id", invoiceId);

  let itemsMatched = 0, itemsCreated = 0;
  // On capture les résultats du matching pour la 2e pass (alerting),
  // notamment previousPrice qui doit être lu AVANT d'insérer le nouveau prix.
  const matchingResults: {
    productId: string;
    item: ExtractedItem;
    previousPrice: number | null;
  }[] = [];

  for (const item of extracted.items) {
    const { productId, wasCreated } = await upsertProduct(
      sb, restaurantId, supplierId, item
    );
    wasCreated ? itemsCreated++ : itemsMatched++;

    // Capture le dernier prix AVANT d'insérer le nouveau (sinon getLastPrice
    // renverrait celui qu'on est en train d'écrire).
    const previousPrice = await getLastPrice(sb, productId);
    matchingResults.push({ productId, item, previousPrice });

    // Lignes flaggées needs_review : on garde la trace dans invoice_items
    // (matched=false) mais on n'écrit PAS dans price_history — un prix
    // incohérent fausserait l'historique à vie.
    if (!item.needs_review) {
      await sb.from("price_history").insert({
        product_id: productId,
        price_ht: item.unit_price_ht,
        invoice_id: invoiceId,
        source: "invoice",
      });
    }

    // Ligne de facture. original_unit_price/original_quantity = valeurs IA
    // figées, pour permettre au chef d'éditer unit_price_ht/quantity tout en
    // gardant la trace de la valeur extraite par Claude (cf migration 006).
    await sb.from("invoice_items").insert({
      invoice_id: invoiceId,
      product_id: productId,
      raw_label: item.raw_label,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_ht: item.unit_price_ht,
      total_price_ht: item.total_price_ht,
      vat_rate: item.vat_rate,
      matched: !wasCreated && !item.needs_review,
      original_unit_price: item.unit_price_ht,
      original_quantity: item.quantity,
    });
  }

  // ─── Phase ALERTING ───
  await sb.from("invoices").update({ processing_step: "alerting" }).eq("id", invoiceId);

  const alerts = [];
  for (const r of matchingResults) {
    if (r.previousPrice === null || r.item.needs_review) continue;
    const changePct = ((r.item.unit_price_ht - r.previousPrice) / r.previousPrice) * 100;
    if (Math.abs(changePct) < PRICE_ALERT_THRESHOLD_PCT) continue;

    const affectedRecipes = await getAffectedRecipes(
      sb, r.productId, r.previousPrice, r.item.unit_price_ht
    );

    await sb.from("margin_alerts").insert({
      restaurant_id: restaurantId,
      product_id: r.productId,
      invoice_id: invoiceId,
      old_price: r.previousPrice,
      new_price: r.item.unit_price_ht,
      price_change_pct: Math.round(changePct * 100) / 100,
      affected_recipes: affectedRecipes,
      is_read: false,
    });

    alerts.push({
      product_name: r.item.raw_label,
      old_price: r.previousPrice,
      new_price: r.item.unit_price_ht,
      price_change_pct: Math.round(changePct * 100) / 100,
      affected_recipes: affectedRecipes,
    });
  }

  // ─── Calcul totaux & variation globale (cf migration 007) ───
  // total_ht = somme des items réels (utilisé pour la timeline dashboard).
  // variation_pct = comparaison pondérée vs prix précédents quand on en a.
  // On ignore les items needs_review pour ne pas biaiser avec un prix faux.
  let totalHt = 0;
  let baseline = 0;
  let currentComparable = 0;
  for (const r of matchingResults) {
    if (r.item.needs_review) continue;
    totalHt += r.item.total_price_ht;
    if (r.previousPrice !== null && r.previousPrice > 0) {
      baseline += r.previousPrice * r.item.quantity;
      currentComparable += r.item.unit_price_ht * r.item.quantity;
    }
  }
  const variationPct = baseline > 0
    ? Math.round(((currentComparable - baseline) / baseline) * 10000) / 100
    : null;

  // ─── Phase FINAL ───
  // status='processed' est la source de vérité pour le client (arrête le polling).
  // Le slot de quota a été réservé EN AMONT par /api/invoices/process via
  // check_and_increment_scan_usage (migration 009). Ici on ne touche plus au
  // compteur — on le laisse "committed". En cas d'échec (status='error' ou
  // 'duplicate'), c'est releaseQuotaSlot qui est appelée pour rendre le crédit.
  await sb.from("invoices").update({
    status: "processed",
    processing_step: "processed",
    total_ht: Math.round(totalHt * 100) / 100,
    variation_pct: variationPct,
  }).eq("id", invoiceId);

  return { invoice_id: invoiceId, extracted, items_matched: itemsMatched, items_created: itemsCreated, alerts };
}

// Message dédié aux pannes de configuration serveur (clé API manquante,
// secret pas synchronisé). Différent des messages "format de fichier" pour
// ne pas faire culpabiliser le chef pour un problème côté infra.
const SERVER_CONFIG_ERROR_MSG =
  "Configuration serveur incomplète. Contactez le support.";

/**
 * Reconnaît une erreur d'authentification du SDK Anthropic. Couvre :
 *   - clé absente (jetée par le SDK avant l'envoi)
 *   - clé invalide / révoquée / expirée (HTTP 401 retourné par l'API)
 * Distingue de l'autre famille (PDF refusé, image floue) pour qu'on ne dise
 * pas au chef que son fichier est mauvais alors que c'est notre conf qui pose
 * problème.
 */
function isAnthropicAuthError(err: unknown): boolean {
  if (!err) return false;
  const status = (err as { status?: number }).status;
  if (status === 401) return true;
  const message = err instanceof Error ? err.message : String(err);
  return /authentication|api[\s_-]?key|x-api-key|authorization/i.test(message);
}

// ─── Entry point ──────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  // Capturés hors try pour pouvoir marquer la facture en 'error' ET libérer
  // le slot de quota dans le catch global (sinon une crash mid-pipeline
  // laisserait status='processing' à vie + un crédit perdu pour l'user).
  let invoice_id: string | null = null;
  let sb: SupabaseClient | null = null;
  let restaurant_id: string | null = null;

  try {
    // ─── Vérif config serveur (avant tout pipeline) ───
    // ANTHROPIC_API_KEY doit être set comme secret Supabase Edge Functions :
    //   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
    // Les variables Vercel ne sont PAS visibles ici (runtime Deno isolé).
    // Sans cette garde, le SDK Anthropic jetait "Could not resolve
    // authentication method" qu'on traduisait en "PDF non supporté" — bug
    // de classification fixé en parallèle (cf catch sur messages.create).
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      console.error("[process-invoice] ANTHROPIC_API_KEY missing — set via `supabase secrets set ANTHROPIC_API_KEY=...`");
    }
    if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || !Deno.env.get("SUPABASE_URL")) {
      console.error("[process-invoice] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
    }

    const body = await req.json();
    invoice_id = body.invoice_id ?? null;
    if (!invoice_id) return json({ error: "invoice_id requis" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

    // Client service-role pour les opérations DB
    sb = createClient(
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
    restaurant_id = invoice.restaurant.id;

    // Passe en "processing" + sous-état "extracting" (Claude lit l'image).
    // Le client poll invoices.processing_step pour afficher des messages
    // dynamiques en attendant la fin du scan.
    await sb.from("invoices").update({
      status: "processing",
      processing_step: "extracting",
    }).eq("id", invoice_id);

    // Téléchargement de l'image depuis Storage
    const { data: imageBlob, error: dlErr } = await sb.storage
      .from("invoices")
      .download(invoice.image_path);

    if (dlErr || !imageBlob) {
      await markInvoiceError(sb, invoice_id, "Image introuvable. Réimportez la facture.");
      if (restaurant_id) await releaseQuotaSlot(sb, restaurant_id);
      return json({ error: "Image introuvable dans Storage" }, 404);
    }

    // Conversion base64
    const arrayBuffer = await imageBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    // Détection robuste : MIME stocké → magic-byte → extension. Indispensable
    // pour les PDFs Google Docs où le navigateur peut envoyer un Content-Type
    // erroné, et pour les filenames sans extension.
    const fileKind = detectFileKind(
      invoice.content_type ?? null,
      bytes,
      invoice.image_path,
    );
    const isPdf = fileKind.kind === "pdf";
    // Message d'erreur user-facing à utiliser en cas d'échec de Claude :
    // distingue PDF non supporté vs image illisible, pour guider le chef.
    const failureMessage = isPdf ? PDF_UNSUPPORTED_MSG : IMAGE_UNREADABLE_MSG;

    // Refuse net si la clé n'est pas configurée — le SDK Anthropic jetterait
    // "Could not resolve authentication method" sinon, et on n'a aucun moyen
    // depuis cette exception d'expliquer au chef que c'est un problème
    // d'infra, pas son PDF.
    //
    // On retourne 500 (config issue = retryable) et on NE libère PAS le slot
    // de quota ici : c'est le caller (/api/invoices/process via after()) qui
    // le fera en voyant la 5xx, pour éviter un double-release.
    if (!anthropicKey) {
      await markInvoiceError(sb, invoice_id, SERVER_CONFIG_ERROR_MSG);
      return json({
        error: SERVER_CONFIG_ERROR_MSG,
        code: "MISSING_ANTHROPIC_KEY",
      }, 500);
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // Claude API : `document` pour les PDFs (support natif Anthropic depuis
    // Claude 3.5 Sonnet), `image` pour le reste. Voir doc :
    // https://docs.claude.com/en/docs/build-with-claude/pdf-support
    const fileBlock = isPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: fileKind.mediaType, data: base64 } };

    let claudeResponse;
    try {
      claudeResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{
          role: "user",
          // deno-lint-ignore no-explicit-any
          content: [fileBlock as any, { type: "text", text: EXTRACTION_PROMPT }],
        }],
      });
    } catch (err) {
      console.error("[process-invoice] anthropic.messages.create failed:", err);

      // Distingue les familles d'erreurs pour ne pas mentir au chef :
      //   - 401 / "authentication" : c'est NOTRE conf qui est cassée (clé
      //     révoquée, secret pas propagé), pas son fichier.
      //   - autre : Anthropic a refusé le contenu (PDF texte pur, image
      //     floue, format non reconnu). Là le message file-kind est légitime.
      if (isAnthropicAuthError(err)) {
        // Idem MISSING_ANTHROPIC_KEY : on retourne 500, le caller libère le
        // slot. Pas de release local pour éviter le double-release.
        await markInvoiceError(sb, invoice_id, SERVER_CONFIG_ERROR_MSG);
        return json({
          error: SERVER_CONFIG_ERROR_MSG,
          code: "ANTHROPIC_AUTH_FAILED",
          details: String(err),
        }, 500);
      }

      await markInvoiceError(sb, invoice_id, failureMessage);
      if (restaurant_id) await releaseQuotaSlot(sb, restaurant_id);
      return json({ error: failureMessage, details: String(err) }, 422);
    }

    const rawText = claudeResponse.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    let extracted: ExtractedInvoice;
    try {
      extracted = parseClaudeResponse(rawText);
    } catch (err) {
      // Si Claude a répondu mais que la réponse n'est pas un JSON parseable,
      // c'est presque toujours qu'il n'a "rien vu" d'exploitable (PDF texte
      // vector, image floue). Message dédié selon le type de fichier.
      await markInvoiceError(sb, invoice_id, failureMessage);
      if (restaurant_id) await releaseQuotaSlot(sb, restaurant_id);
      return json({ error: failureMessage, details: String(err) }, 422);
    }

    // Fix audit C6 — log des items dont le prix tombe hors range raisonnable
    // (visible dans les logs Supabase Edge même tant que l'UI ne montre rien)
    for (const flaggedItem of extracted.items) {
      if (flaggedItem.review_reason?.includes("price_out_of_range")) {
        console.warn("[process-invoice] price_out_of_range", {
          invoice_id,
          raw_label: flaggedItem.raw_label,
          unit_price_ht: flaggedItem.unit_price_ht,
          review_reason: flaggedItem.review_reason,
        });
      }
    }

    // Pipeline complet
    let result;
    try {
      result = await processInvoice(sb, invoice.restaurant.id, invoice_id, extracted);
    } catch (err) {
      if (err instanceof DuplicateInvoiceError) {
        // Nettoyage : on supprime le fichier uploadé en double pour ne pas
        // gonfler le storage (la ligne invoices reste, marquée 'duplicate',
        // pour traçabilité et debug si besoin). Et on libère le slot de
        // quota — un duplicate ne doit pas consommer un crédit.
        await sb.storage.from("invoices").remove([invoice.image_path]).catch(() => {});
        if (restaurant_id) await releaseQuotaSlot(sb, restaurant_id);
        return json({
          error: "Cette facture a déjà été enregistrée.",
          code: "DUPLICATE_INVOICE",
          existing_invoice_id: err.existingInvoiceId,
        }, 409);
      }
      throw err;
    }

    return json(result, 200);

  } catch (err) {
    console.error("[process-invoice] Fatal:", err);
    // Garantit qu'aucune facture ne reste bloquée en 'processing' après un crash.
    // En revanche on NE libère PAS le slot de quota ici : c'est le caller
    // (/api/invoices/process via after()) qui le fera en voyant le 5xx, pour
    // éviter un double-release. Les erreurs "métier" (parsing/duplicate/image
    // missing) sont gérées plus haut dans la chaîne, là on libère localement.
    //
    // Pas de message dédié au type de fichier ici : on ne sait pas si on a
    // crashé avant ou après la détection. Message générique.
    if (invoice_id && sb) {
      try {
        await sb.from("invoices").update({
          status: "error",
          error_message: "Une erreur inattendue est survenue. Réessayez ou contactez le support.",
        }).eq("id", invoice_id);
      } catch (e2) {
        console.error("[process-invoice] failed to mark invoice as error:", e2);
      }
    }
    return json({ error: "Erreur interne", details: String(err) }, 500);
  }
});
