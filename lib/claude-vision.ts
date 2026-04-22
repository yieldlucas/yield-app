import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedInvoice } from "@/types/invoice";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export async function extractInvoiceData(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<ExtractedInvoice> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("");

  return parseClaudeResponse(rawText);
}

export async function extractInvoiceFromUrl(imageUrl: string): Promise<ExtractedInvoice> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: imageUrl,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("");

  return parseClaudeResponse(rawText);
}

function parseClaudeResponse(raw: string): ExtractedInvoice {
  // Nettoie les éventuels blocs markdown que le modèle aurait ajoutés
  const cleaned = raw
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  let parsed: ExtractedInvoice;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Réponse Claude non parseable : ${cleaned.slice(0, 200)}`);
  }

  // Validation minimale
  if (!parsed.supplier_name || !Array.isArray(parsed.items)) {
    throw new Error("Structure JSON invalide : champs obligatoires manquants");
  }

  // Normalisation des items
  parsed.items = parsed.items.map((item) => ({
    ...item,
    quantity: Number(item.quantity) || 0,
    unit_price_ht: Number(item.unit_price_ht) || 0,
    total_price_ht: Number(item.total_price_ht) || 0,
    vat_rate: Number(item.vat_rate) ?? 5.5,
  }));

  return parsed;
}
