// Helpers de lecture / mutation côté client pour le dashboard.
//
// Toutes les fonctions s'appuient sur la RLS Supabase pour limiter au scope
// du caller (owner_invoices, owner_margin_alerts, owner_read_usage). Pas de
// vérif ownership en plus côté client — la base est seule source de vérité.

import { supabase } from "@/lib/supabase-browser";
import { type Alert, type RecentInvoice } from "../_components/types";

const RECENT_INVOICES_LIMIT = 30;
const UNREAD_ALERTS_LIMIT = 10;

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
      "id, price_change_pct, old_price, new_price, affected_recipes, is_read, created_at, invoice_id, product:products(name), invoice:invoices(supplier:suppliers(name))",
    )
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(UNREAD_ALERTS_LIMIT);
  if (error || !data) return [];
  type Row = {
    id: string;
    price_change_pct: number;
    old_price: number;
    new_price: number;
    affected_recipes: { name: string; margin_impact_pts: number }[] | null;
    is_read: boolean;
    created_at: string;
    invoice_id: string | null;
    product: { name: string } | null;
    invoice: { supplier: { name: string } | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    product_name: r.product?.name ?? "Produit inconnu",
    price_change_pct: Number(r.price_change_pct),
    old_price: Number(r.old_price),
    new_price: Number(r.new_price),
    affected_recipes: r.affected_recipes ?? [],
    is_read: r.is_read,
    created_at: r.created_at,
    invoice_id: r.invoice_id,
    supplier_name: r.invoice?.supplier?.name ?? null,
  }));
}

/** Marque une alerte lue (RLS WITH CHECK valide l'update). */
export async function markAlertRead(id: string): Promise<boolean> {
  const { error } = await supabase.from("margin_alerts").update({ is_read: true }).eq("id", id);
  return !error;
}

/** Marque plusieurs alertes lues d'un coup. */
export async function markAlertsRead(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { error } = await supabase.from("margin_alerts").update({ is_read: true }).in("id", ids);
  return !error;
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
