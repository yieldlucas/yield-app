// Types et constantes partagés par les composants du dashboard.
// Centralisés ici pour éviter les imports croisés et les duplications.

/** Code couleur strict pour les variations de prix.
 *  - hausse > 7%   → rose-500  (#EF4444)
 *  - baisse > 0%   → emerald-500 (#10B981)
 *  - sinon         → slate-400 (neutre)
 *  Aligné avec PRICE_ALERT_THRESHOLD_PCT côté edge function. */
export const VARIATION_ALERT_PCT = 7;

export interface Alert {
  id: string;
  product_name: string;
  price_change_pct: number;
  old_price: number;
  new_price: number;
  affected_recipes: { name: string; margin_impact_pts: number }[];
  is_read: boolean;
  created_at: string;
}

export interface RecentInvoice {
  id: string;
  supplier_name: string;
  /** 'YYYY-MM-DD' ou ISO complet. */
  invoice_date: string;
  status: "pending" | "processing" | "processed" | "error" | "duplicate";
  items_count: number;
  total_ht?: number | null;
  /** null = pas de comparaison possible (premier scan de ce produit). */
  variation_pct?: number | null;
  processing_step?: "extracting" | "matching" | "alerting" | "processed" | null;
}

export interface BatchItem {
  id: string;
  fileName: string;
  status: "queued" | "uploading" | "processing" | "done" | "error";
  error?: string;
  supplier?: string | null;
  itemsCount?: number;
  /** Sous-état pendant 'processing' — alimenté par polling de invoices.processing_step. */
  processingStep?: "extracting" | "matching" | "alerting" | null;
  totalItemsCount?: number | null;
}
