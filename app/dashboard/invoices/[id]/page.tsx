"use client";

import { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Download, FileText, X, ZoomIn, Check, Pencil,
  ChevronDown, RotateCcw, Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

// Aligné avec dashboard/page.tsx — code couleur strict variation
const VARIATION_ALERT_PCT = 7;

type ItemRow = {
  id: string;
  product_id: string | null;
  raw_label: string;
  quantity: number;
  unit: string | null;
  unit_price_ht: number;
  total_price_ht: number;
  vat_rate: number | null;
  matched: boolean;
  original_unit_price: number | null;
  original_quantity: number | null;
  corrected_at: string | null;
  // Enrichi côté client
  previous_price: number | null;
  // Brouillon d'édition (tant que non sauvegardé)
  draft_unit_price: number;
  draft_quantity: number;
  draft_label: string;
};

type InvoiceFull = {
  id: string;
  status: string;
  invoice_date: string | null;
  invoice_number: string | null;
  created_at: string;
  total_ht: number | null;
  variation_pct: number | null;
  image_path: string;
  supplier: { name: string } | null;
};

function formatEur(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function variationStyle(pct: number | null): { tone: string; arrow: string } {
  if (pct == null) return { tone: "text-slate-400 bg-slate-50 border-slate-100", arrow: "—" };
  if (pct >= VARIATION_ALERT_PCT) return { tone: "text-rose-600 bg-rose-50 border-rose-100", arrow: "↗" };
  if (pct < 0) return { tone: "text-emerald-600 bg-emerald-50 border-emerald-100", arrow: "↘" };
  return { tone: "text-slate-500 bg-slate-50 border-slate-100", arrow: "→" };
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceFull | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"price" | "qty" | "label" | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  // ── Chargement initial ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: inv, error: invErr } = await supabase
          .from("invoices")
          .select(`
            id, status, invoice_date, invoice_number, created_at, total_ht, variation_pct,
            image_path, supplier:suppliers(name)
          `)
          .eq("id", invoiceId)
          .maybeSingle();
        if (invErr) throw invErr;
        if (!inv) throw new Error("Facture introuvable.");

        const { data: rawItems, error: itemsErr } = await supabase
          .from("invoice_items")
          .select(`
            id, product_id, raw_label, quantity, unit, unit_price_ht, total_price_ht,
            vat_rate, matched, original_unit_price, original_quantity, corrected_at
          `)
          .eq("invoice_id", invoiceId);
        if (itemsErr) throw itemsErr;

        // Récupère les prix précédents pour ghost pricing — un seul aller-retour DB.
        const productIds = (rawItems ?? []).map(it => (it as { product_id: string | null }).product_id).filter(Boolean) as string[];
        const prevByProduct = new Map<string, number>();
        if (productIds.length > 0) {
          const { data: prevPrices } = await supabase
            .from("price_history")
            .select("product_id, price_ht, recorded_at, invoice_id")
            .in("product_id", productIds)
            .order("recorded_at", { ascending: false });
          for (const p of (prevPrices ?? []) as { product_id: string; price_ht: number; invoice_id: string | null }[]) {
            // On ignore l'entrée price_history créée PAR cette facture (sinon
            // "previous" = le prix actuel). On garde la première suivante.
            if (p.invoice_id === invoiceId) continue;
            if (!prevByProduct.has(p.product_id)) prevByProduct.set(p.product_id, Number(p.price_ht));
          }
        }

        const enriched: ItemRow[] = (rawItems ?? []).map(rawIt => {
          const it = rawIt as Omit<ItemRow, "previous_price" | "draft_unit_price" | "draft_quantity" | "draft_label">;
          return {
            ...it,
            previous_price: it.product_id ? prevByProduct.get(it.product_id) ?? null : null,
            draft_unit_price: Number(it.unit_price_ht),
            draft_quantity: Number(it.quantity),
            draft_label: it.raw_label,
          };
        });

        const fullInvoice = inv as unknown as InvoiceFull;

        // Signed URL pour l'image (bucket invoices est privé depuis migration 003).
        const { data: signed } = await supabase.storage
          .from("invoices")
          .createSignedUrl(fullInvoice.image_path, 3600);

        if (cancelled) return;
        setInvoice(fullInvoice);
        setItems(enriched);
        setImageUrl(signed?.signedUrl ?? null);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erreur de chargement");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceId]);

  // ── Détection des modifications ───
  const dirtyItems = useMemo(() => items.filter(it =>
    it.draft_unit_price !== Number(it.unit_price_ht) ||
    it.draft_quantity !== Number(it.quantity) ||
    it.draft_label !== it.raw_label
  ), [items]);

  // ── Recalcul live du total HT côté client ───
  const draftTotalHt = useMemo(() =>
    items.reduce((sum, it) => sum + it.draft_unit_price * it.draft_quantity, 0),
    [items],
  );

  // ── Sauvegarde ───
  const saveCorrections = async () => {
    if (dirtyItems.length === 0 || !invoice) return;
    setSaving(true);
    try {
      // 1. Update chaque invoice_item modifié + price_history correspondant.
      //    On batche en parallèle — RLS owner_invoice_items / owner_price_history
      //    valide les writes côté DB (cf migrations 001 + 003).
      await Promise.all(dirtyItems.map(async it => {
        const newTotal = Math.round(it.draft_unit_price * it.draft_quantity * 100) / 100;
        await supabase.from("invoice_items").update({
          unit_price_ht: it.draft_unit_price,
          quantity: it.draft_quantity,
          total_price_ht: newTotal,
          raw_label: it.draft_label,
          corrected_at: new Date().toISOString(),
        }).eq("id", it.id);

        // Réplication price_history : on ne touche que la ligne créée par CE
        // scan (invoice_id = invoiceId, product_id = ce produit). Les autres
        // entrées historiques restent intactes.
        if (it.product_id && it.draft_unit_price !== Number(it.unit_price_ht)) {
          await supabase.from("price_history")
            .update({ price_ht: it.draft_unit_price })
            .eq("invoice_id", invoiceId)
            .eq("product_id", it.product_id);
        }
      }));

      // 2. Recalcul du total HT facture + variation_pct (avec les nouveaux prix).
      const newTotalHt = Math.round(draftTotalHt * 100) / 100;
      let baseline = 0, currentComparable = 0;
      for (const it of items) {
        if (it.previous_price != null && it.previous_price > 0) {
          baseline += it.previous_price * it.draft_quantity;
          currentComparable += it.draft_unit_price * it.draft_quantity;
        }
      }
      const newVariation = baseline > 0
        ? Math.round(((currentComparable - baseline) / baseline) * 10000) / 100
        : null;
      await supabase.from("invoices").update({
        total_ht: newTotalHt,
        variation_pct: newVariation,
      }).eq("id", invoiceId);

      // 3. Sync state local avec les valeurs sauvegardées (les drafts deviennent canon)
      setItems(prev => prev.map(it => ({
        ...it,
        unit_price_ht: it.draft_unit_price,
        quantity: it.draft_quantity,
        total_price_ht: Math.round(it.draft_unit_price * it.draft_quantity * 100) / 100,
        raw_label: it.draft_label,
        corrected_at: new Date().toISOString(),
      })));
      setInvoice(prev => prev ? { ...prev, total_ht: newTotalHt, variation_pct: newVariation } : prev);
      setSavedAt(Date.now());
      setEditingId(null);
      setEditingField(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const revertItem = (id: string) => {
    setItems(prev => prev.map(it => it.id === id ? {
      ...it,
      draft_unit_price: Number(it.unit_price_ht),
      draft_quantity: Number(it.quantity),
      draft_label: it.raw_label,
    } : it));
  };

  // ── Export ───
  const exportPdf = async () => {
    setActionsOpen(false);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    window.open(`/api/invoices/${invoiceId}/export-pdf?t=${encodeURIComponent(session.access_token)}`, "_blank");
  };
  const exportCsv = async () => {
    setActionsOpen(false);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    window.open(`/api/invoices/${invoiceId}/export-csv?t=${encodeURIComponent(session.access_token)}`, "_blank");
  };

  // ── States UI ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F9FF" }}>
        <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#F7F9FF" }}>
        <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
          <p className="text-rose-600 font-semibold mb-2">{error ?? "Facture introuvable"}</p>
          <Link href="/dashboard" className="text-blue-600 text-sm font-medium">← Retour au dashboard</Link>
        </div>
      </div>
    );
  }

  const variationStyleObj = variationStyle(invoice.variation_pct);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#F7F9FF" }}>
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-50" aria-label="Retour">
            <ArrowLeft size={18} className="text-slate-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 font-bold text-sm sm:text-base truncate">
              {invoice.supplier?.name ?? "Fournisseur inconnu"}
            </p>
            <p className="text-slate-400 text-[11px] sm:text-xs truncate">
              {invoice.invoice_number ? `BL ${invoice.invoice_number} · ` : ""}
              {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Date inconnue"}
            </p>
          </div>

          {/* Action menu */}
          <div className="relative">
            <button
              onClick={() => setActionsOpen(o => !o)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"
            >
              <Download size={13} /> Exporter <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {actionsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-40"
                >
                  <button onClick={exportPdf} className="w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    <FileText size={14} className="text-rose-500" /> PDF propre
                  </button>
                  <button onClick={exportCsv} className="w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100">
                    <FileText size={14} className="text-emerald-500" /> CSV (Excel)
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ─── Split-view ─── */}
      <div className="max-w-6xl mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Photo ── */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Photo originale</p>
              <button onClick={() => setZoomOpen(true)} className="text-slate-400 hover:text-blue-600" aria-label="Agrandir">
                <ZoomIn size={15} />
              </button>
            </div>
            <button
              onClick={() => setZoomOpen(true)}
              className="block w-full bg-slate-50"
              style={{ minHeight: 200, maxHeight: "70vh" }}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="Facture" className="w-full h-full object-contain max-h-[70vh]" />
              ) : (
                <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Image indisponible</div>
              )}
            </button>
          </div>
        </div>

        {/* ── Tableau intelligent ── */}
        <div>
          {/* Total card */}
          <div className="rounded-xl bg-white border border-slate-100 shadow-sm p-4 mb-3 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-[11px] uppercase tracking-wide font-semibold">Total HT</p>
              <p className="text-slate-900 text-2xl font-bold tabular-nums leading-tight mt-0.5">
                {formatEur(draftTotalHt)}
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border tabular-nums ${variationStyleObj.tone}`}>
              {variationStyleObj.arrow} {invoice.variation_pct != null
                ? `${invoice.variation_pct > 0 ? "+" : ""}${invoice.variation_pct.toFixed(1)}%`
                : "—"}
            </span>
          </div>

          {/* Items table */}
          <div className="rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
                {items.length} produit{items.length > 1 ? "s" : ""} extrait{items.length > 1 ? "s" : ""}
              </p>
              {dirtyItems.length > 0 && (
                <p className="text-amber-600 text-[11px] font-medium">
                  {dirtyItems.length} modification{dirtyItems.length > 1 ? "s" : ""} en attente
                </p>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {items.map(it => {
                const isEditingPrice = editingId === it.id && editingField === "price";
                const isEditingQty   = editingId === it.id && editingField === "qty";
                const isEditingLabel = editingId === it.id && editingField === "label";
                const isDirty = it.draft_unit_price !== Number(it.unit_price_ht)
                  || it.draft_quantity !== Number(it.quantity)
                  || it.draft_label !== it.raw_label;
                const variationPct = it.previous_price && it.previous_price > 0
                  ? ((it.draft_unit_price - it.previous_price) / it.previous_price) * 100
                  : null;
                const v = variationStyle(variationPct);

                return (
                  <div key={it.id} className={`px-4 py-3 ${isDirty ? "bg-amber-50/40" : ""}`}>
                    {/* Ligne 1 : libellé (cliquable pour éditer) */}
                    <div className="flex items-start gap-2 mb-1.5">
                      {isEditingLabel ? (
                        <input
                          autoFocus
                          value={it.draft_label}
                          onChange={e => setItems(p => p.map(x => x.id === it.id ? { ...x, draft_label: e.target.value } : x))}
                          onBlur={() => { setEditingId(null); setEditingField(null); }}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { setEditingId(null); setEditingField(null); } }}
                          className="flex-1 min-w-0 text-sm font-semibold text-slate-900 bg-white border border-blue-300 rounded-md px-2 py-1 focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingId(it.id); setEditingField("label"); }}
                          className="flex-1 min-w-0 text-left group"
                        >
                          <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 inline-flex items-center gap-1.5">
                            {it.draft_label}
                            <Pencil size={11} className="opacity-0 group-hover:opacity-100 text-slate-400" />
                          </p>
                        </button>
                      )}
                      {isDirty && (
                        <button onClick={() => revertItem(it.id)} className="text-slate-400 hover:text-rose-500" aria-label="Annuler">
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>

                    {/* Ligne 2 : qty | prix unit | variation */}
                    <div className="flex items-center gap-3 text-sm">
                      {/* Quantité */}
                      <div className="flex-shrink-0">
                        {isEditingQty ? (
                          <input
                            autoFocus
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={it.draft_quantity}
                            onChange={e => setItems(p => p.map(x => x.id === it.id ? { ...x, draft_quantity: Number(e.target.value) || 0 } : x))}
                            onBlur={() => { setEditingId(null); setEditingField(null); }}
                            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { setEditingId(null); setEditingField(null); } }}
                            className="w-20 text-sm tabular-nums bg-white border border-blue-300 rounded-md px-2 py-1 focus:outline-none focus:border-blue-500"
                          />
                        ) : (
                          <button
                            onClick={() => { setEditingId(it.id); setEditingField("qty"); }}
                            className="text-slate-700 tabular-nums hover:text-blue-600"
                            title="Modifier la quantité"
                          >
                            {it.draft_quantity.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
                            <span className="text-slate-400 ml-1">{it.unit ?? ""}</span>
                          </button>
                        )}
                      </div>

                      {/* Prix unit + ghost previous */}
                      <div className="flex-1 min-w-0">
                        {isEditingPrice ? (
                          <input
                            autoFocus
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={it.draft_unit_price}
                            onChange={e => setItems(p => p.map(x => x.id === it.id ? { ...x, draft_unit_price: Number(e.target.value) || 0 } : x))}
                            onBlur={() => { setEditingId(null); setEditingField(null); }}
                            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { setEditingId(null); setEditingField(null); } }}
                            className="w-24 text-sm tabular-nums bg-white border border-blue-300 rounded-md px-2 py-1 focus:outline-none focus:border-blue-500"
                          />
                        ) : (
                          <button
                            onClick={() => { setEditingId(it.id); setEditingField("price"); }}
                            className="text-left hover:text-blue-600 group"
                            title="Modifier le prix"
                          >
                            <p className="text-slate-900 font-semibold tabular-nums">
                              {formatEur(it.draft_unit_price)}
                            </p>
                            {it.previous_price != null && (
                              <p className="text-[10px] text-slate-300 tabular-nums leading-tight">
                                Avant : {formatEur(it.previous_price)}
                              </p>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Variation */}
                      <div className="flex-shrink-0">
                        {variationPct != null ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border tabular-nums ${v.tone}`}>
                            {v.arrow} {variationPct > 0 ? "+" : ""}{variationPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-slate-300">—</span>
                        )}
                      </div>
                    </div>

                    {/* Footer ligne : indicateur correction historique */}
                    {it.corrected_at && (
                      <p className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1">
                        <Check size={10} /> Corrigé manuellement
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Helper */}
          <p className="text-slate-400 text-[11px] mt-3 px-1 leading-relaxed">
            Cliquez sur une cellule pour la modifier. L'IA peut se tromper sur les unités ou les prix manuscrits — vos corrections sont enregistrées et alimentent l'historique des prix.
          </p>
        </div>
      </div>

      {/* ─── Bottom CTA flottant si modifs ─── */}
      <AnimatePresence>
        {dirtyItems.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-lg"
          >
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-slate-700 text-sm font-medium">
                {dirtyItems.length} ligne{dirtyItems.length > 1 ? "s" : ""} modifiée{dirtyItems.length > 1 ? "s" : ""}
              </p>
              <button
                onClick={saveCorrections}
                disabled={saving}
                className="btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Valider les corrections
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
        {/* Toast "sauvegardé" */}
        {savedAt && Date.now() - savedAt < 3000 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg flex items-center gap-2"
          >
            <Check size={14} /> Corrections enregistrées
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Photo zoom modal ─── */}
      <AnimatePresence>
        {zoomOpen && imageUrl && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/95 flex items-center justify-center p-4"
            onClick={() => setZoomOpen(false)}
          >
            <button
              onClick={() => setZoomOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Facture pleine taille" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
