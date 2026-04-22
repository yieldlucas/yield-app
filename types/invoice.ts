// Types métier pour l'extraction et le traitement des factures

export type InvoiceUnit =
  | "kg" | "g" | "L" | "cL" | "mL"
  | "pièce" | "barquette" | "carton" | "bouteille" | "sachet"
  | "botte" | "filet" | "plateau" | "unité";

export interface ExtractedItem {
  raw_label: string;       // libellé brut de la facture
  reference_code?: string; // code article fournisseur
  quantity: number;
  unit: InvoiceUnit | string;
  unit_price_ht: number;
  total_price_ht: number;
  vat_rate: number;        // 0, 5.5, 10 ou 20
}

export interface ExtractedInvoice {
  supplier_name: string;
  invoice_number?: string;
  invoice_date?: string;   // ISO 8601 : "2024-03-15"
  items: ExtractedItem[];
  extraction_confidence: "high" | "medium" | "low";
  extraction_notes?: string;
}

export interface PriceChangeAlert {
  product_id: string;
  product_name: string;
  old_price: number;
  new_price: number;
  price_change_pct: number;
  affected_recipes: AffectedRecipe[];
}

export interface AffectedRecipe {
  id: string;
  name: string;
  margin_impact_pts: number; // points de marge perdus
}

export interface ProcessInvoiceResult {
  invoice_id: string;
  extracted: ExtractedInvoice;
  items_matched: number;
  items_created: number;
  alerts: PriceChangeAlert[];
}
