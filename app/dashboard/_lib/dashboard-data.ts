// Helpers de lecture / mutation côté client pour le dashboard.
//
// Toutes les fonctions s'appuient sur la RLS Supabase pour limiter au scope
// du caller (owner_invoices, owner_margin_alerts, owner_read_usage). Pas de
// vérif ownership en plus côté client — la base est seule source de vérité.

import { supabase } from "@/lib/supabase-browser";
import { type Alert, type RecentInvoice } from "../_components/types";

const RECENT_INVOICES_LIMIT = 30;
const UNREAD_ALERTS_LIMIT = 10;

export type MonthlyStats = {
  /** Somme des total_ht (HT €) des factures processed du mois courant. */
  totalHt: number;
  /** Moyenne pondérée par total_ht des variation_pct du mois.
   *  Chaque variation_pct est elle-même calculée par l'edge function en
   *  comparant aux prix précédents de l'historique. NULL si aucune facture
   *  comparable (premier mois, ou aucun produit déjà scanné précédemment). */
  weightedVariationPct: number | null;
  /** Nombre de factures processed ce mois (utile pour conditionner l'affichage). */
  invoicesCount: number;
};

/**
 * Stats agrégées du mois courant pour le strip KPIs du dashboard.
 * Une seule requête SELECT (pas de RPC), RLS owner_invoices applique le scope.
 */
export async function fetchMonthlyStats(): Promise<MonthlyStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await supabase
    .from("invoices")
    .select("total_ht, variation_pct")
    .eq("status", "processed")
    .gte("invoice_date", monthStart);

  const empty: MonthlyStats = { totalHt: 0, weightedVariationPct: null, invoicesCount: 0 };
  if (error || !data) return empty;

  type Row = { total_ht: number | null; variation_pct: number | null };
  const rows = data as unknown as Row[];

  let totalHt = 0;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of rows) {
    const ht = Number(r.total_ht ?? 0);
    totalHt += ht;
    // On pondère par total_ht : un BL de 5000€ pèse 100x plus qu'un BL de 50€.
    // Évite qu'une grosse hausse sur un mini-BL fasse exploser la moyenne.
    if (r.variation_pct != null && ht > 0) {
      weightedSum += Number(r.variation_pct) * ht;
      weightTotal += ht;
    }
  }
  return {
    totalHt,
    weightedVariationPct: weightTotal > 0 ? weightedSum / weightTotal : null,
    invoicesCount: rows.length,
  };
}

/** Lit le compteur de scans du mois courant (RLS owner_read_usage). */
export async function fetchUsage(quota: number): Promise<{ used: number; quota: number }> {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const { data } = await supabase
    .from("usage_stats")
    .select("scan_count")
    .eq("year_month", yearMonth)
    .maybeSingle();
  const used = (data as { scan_count?: number } | null)?.scan_count ?? 0;
  return { used, quota };
}

/** Charge les 30 dernières factures du restaurant courant. */
export async function fetchInvoices(): Promise<RecentInvoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, status, processing_step, total_ht, variation_pct, invoice_date, created_at, total_items_count, error_message, supplier:suppliers(name)",
    )
    .order("created_at", { ascending: false })
    .limit(RECENT_INVOICES_LIMIT);
  if (error || !data) return [];
  type Row = {
    id: string;
    status: RecentInvoice["status"];
    processing_step: RecentInvoice["processing_step"];
    total_ht: number | null;
    variation_pct: number | null;
    invoice_date: string | null;
    created_at: string;
    total_items_count: number | null;
    error_message: string | null;
    supplier: { name: string } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    supplier_name: r.supplier?.name ?? "Fournisseur inconnu",
    invoice_date: r.invoice_date ?? r.created_at,
    status: r.status,
    items_count: r.total_items_count ?? 0,
    total_ht: r.total_ht,
    variation_pct: r.variation_pct,
    processing_step: r.processing_step,
    error_message: r.error_message,
  }));
}

/**
 * Compare deux versions d'une liste de factures pour décider s'il faut
 * propager le nouvel état. Évite un re-render coûteux à chaque tick de
 * polling quand l'edge function n'a pas encore avancé.
 */
export function invoicesChanged(prev: RecentInvoice[], next: RecentInvoice[]): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a.id !== b.id ||
      a.status !== b.status ||
      a.processing_step !== b.processing_step ||
      a.total_ht !== b.total_ht ||
      a.variation_pct !== b.variation_pct ||
      a.items_count !== b.items_count ||
      a.error_message !== b.error_message
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Charge les 10 alertes non-lues les plus récentes, jointes au nom du
 * fournisseur de la facture qui les a déclenchées (pour le drawer cloche).
 */
export async function fetchAlerts(): Promise<Alert[]> {
  const { data, error } = await supabase
    .from("margin_alerts")
    .select(
      "id, product_id, price_change_pct, old_price, new_price, affected_recipes, is_read, created_at, invoice_id, product:products(name, is_seasonal), invoice:invoices(supplier:suppliers(name))",
    )
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(UNREAD_ALERTS_LIMIT);
  if (error || !data) return [];
  type Row = {
    id: string;
    product_id: string | null;
    price_change_pct: number;
    old_price: number;
    new_price: number;
    affected_recipes: { name: string; margin_impact_pts: number }[] | null;
    is_read: boolean;
    created_at: string;
    invoice_id: string | null;
    product: { name: string; is_seasonal: boolean | null } | null;
    invoice: { supplier: { name: string } | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    product_id: r.product_id,
    product_name: r.product?.name ?? "Produit inconnu",
    price_change_pct: Number(r.price_change_pct),
    old_price: Number(r.old_price),
    new_price: Number(r.new_price),
    affected_recipes: r.affected_recipes ?? [],
    is_read: r.is_read,
    created_at: r.created_at,
    invoice_id: r.invoice_id,
    supplier_name: r.invoice?.supplier?.name ?? null,
    product_is_seasonal: r.product?.is_seasonal === true,
  }));
}

/** Marque une alerte lue (RLS WITH CHECK valide l'update). */
export async function markAlertRead(id: string): Promise<boolean> {
  const { error } = await supabase.from("margin_alerts").update({ is_read: true }).eq("id", id);
  return !error;
}

/** Bascule le flag is_seasonal d'un produit (UPDATE direct via RLS owner_products).
 *  Quand true, les alertes sur ce produit seront masquées par défaut dans la cloche
 *  — utile pour ignorer la saisonnalité des tomates, asperges, etc. */
export async function toggleProductSeasonal(
  productId: string,
  seasonal: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from("products")
    .update({ is_seasonal: seasonal })
    .eq("id", productId);
  return !error;
}

/** Compte les factures (status='processed') scannées dans les N derniers jours.
 *  Sert au nudge "vos prix datent" sur le dashboard quand la fréquence baisse. */
export async function fetchRecentScansCount(daysWindow = 7): Promise<number> {
  const since = new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("status", "processed")
    .gte("created_at", since);
  if (error) return 0;
  return count ?? 0;
}

/** Marque plusieurs alertes lues d'un coup. */
export async function markAlertsRead(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { error } = await supabase.from("margin_alerts").update({ is_read: true }).in("id", ids);
  return !error;
}

export type ProductWithLastPrice = {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  /** Dernier prix HT enregistré dans price_history. NULL si le produit a été
   *  créé manuellement et n'a jamais été présent sur une facture scannée. */
  last_price_ht: number | null;
  last_price_at: string | null;
};

/**
 * Recherche dans le catalogue produits enrichi du dernier prix connu.
 * Utilisé par FlashCalculator (autocomplete). Vue products_with_last_price
 * créée en migration 013, RLS via security_invoker.
 */
export async function searchProductsWithLastPrice(
  query: string,
  limit = 10,
): Promise<ProductWithLastPrice[]> {
  const trimmed = query.trim();
  let req = supabase
    .from("products_with_last_price")
    .select("id, name, unit, category, last_price_ht, last_price_at")
    .order("name", { ascending: true })
    .limit(limit);
  if (trimmed.length > 0) {
    req = req.ilike("name", `%${trimmed}%`);
  }
  const { data, error } = await req;
  if (error || !data) return [];
  return (data as unknown as ProductWithLastPrice[]).map((r) => ({
    ...r,
    last_price_ht: r.last_price_ht == null ? null : Number(r.last_price_ht),
  }));
}

export type InvoiceLineForCalc = {
  productId: string | null;
  name: string;
  unit: string;
  pricePerUnitHt: number | null;
  quantity: number;
  quantityUnit: string;
};

/**
 * Lit les lignes d'une facture pour pré-remplir le FlashCalculator. Utilisé
 * par le raccourci "Créer une recette depuis cette facture" — chaque ligne
 * devient un ingrédient.
 *
 * Les lignes sans prix unitaire sont filtrées (inutilisables dans le
 * calcul de marge). Limité à 12 lignes pour ne pas faire exploser la modale —
 * une recette typique a 3-8 ingrédients, au-delà l'user retire ce qu'il ne
 * veut pas plutôt que d'avoir 30 lignes pré-remplies.
 */
export async function fetchInvoiceLinesForCalc(
  invoiceId: string,
  maxLines = 12,
): Promise<InvoiceLineForCalc[]> {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("product_id, raw_label, quantity, unit, unit_price_ht")
    .eq("invoice_id", invoiceId)
    .limit(maxLines);
  if (error || !data) return [];
  type Row = {
    product_id: string | null;
    raw_label: string;
    quantity: number | null;
    unit: string | null;
    unit_price_ht: number | null;
  };
  return (data as unknown as Row[])
    .filter((r) => r.unit_price_ht != null && Number(r.unit_price_ht) > 0)
    .map((r) => ({
      productId: r.product_id,
      name: r.raw_label,
      unit: r.unit ?? "",
      pricePerUnitHt: r.unit_price_ht == null ? null : Number(r.unit_price_ht),
      quantity: r.quantity == null ? 1 : Number(r.quantity),
      quantityUnit: r.unit ?? "",
    }));
}

/**
 * Supprime une facture et son fichier dans Storage.
 * Récupère `image_path` AVANT le delete (sinon RLS bloquerait la lecture
 * une fois la ligne disparue).
 */
export async function deleteInvoice(id: string): Promise<boolean> {
  const { data: row } = await supabase.from("invoices").select("image_path").eq("id", id).maybeSingle();
  const imagePath = (row as { image_path?: string } | null)?.image_path;
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) return false;
  if (imagePath) {
    // Best-effort : un fichier orphelin ne bloque pas le flow.
    await supabase.storage.from("invoices").remove([imagePath]).catch(() => {});
  }
  return true;
}
