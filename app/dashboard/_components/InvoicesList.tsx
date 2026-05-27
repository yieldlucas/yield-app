"use client";

import { motion } from "framer-motion";
import { Camera, FolderOpen } from "lucide-react";
import { InvoiceCard } from "./InvoiceCard";
import { ProvisionalInvoiceCard } from "./ProvisionalInvoiceCard";
import { type BatchItem, type RecentInvoice, VARIATION_ALERT_PCT } from "./types";

export type InvoiceFilter = "all" | "rising" | "this_month";

/**
 * Section "Bons de Livraison" du dashboard : header + chips de filtre +
 * liste filtrée. Le filtre est un état contrôlé par le parent.
 */
export function InvoicesList({
  invoices,
  filter,
  onFilterChange,
  onOpenCamera,
  onOpenGallery,
  onInvoiceClick,
  onInvoiceDismiss,
  onCreateRecipeFromInvoice,
  provisional = [],
  onRetryProvisional,
  onDismissProvisional,
}: {
  invoices: RecentInvoice[];
  filter: InvoiceFilter;
  onFilterChange: (f: InvoiceFilter) => void;
  onOpenCamera: () => void;
  onOpenGallery: () => void;
  onInvoiceClick: (id: string) => void;
  onInvoiceDismiss: (id: string) => void;
  /** Optionnel — affiche un raccourci "Créer une recette" sur chaque BL processed. */
  onCreateRecipeFromInvoice?: (id: string) => void;
  /** Lot en cours : cartes provisoires affichées en tête, toujours visibles
   *  (hors filtre) car elles représentent l'activité immédiate. */
  provisional?: BatchItem[];
  onRetryProvisional?: (id: string) => void;
  onDismissProvisional?: (id: string) => void;
}) {
  // Cartes provisoires à rendre : tout sauf `done` (une carte `done` a déjà
  // cédé la place à sa vraie carte facture issue du polling DB).
  const provisionalCards = provisional.filter((i) => i.status !== "done");
  // Lignes DB "possédées" par une carte provisoire active → on les masque pour
  // éviter le doublon (la carte provisoire est la seule à les représenter
  // jusqu'à `done`).
  const ownedIds = new Set(
    provisional
      .filter((i) => i.invoiceId && i.status !== "done")
      .map((i) => i.invoiceId as string),
  );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const filtered = invoices.filter((inv) => {
    if (ownedIds.has(inv.id)) return false;
    if (filter === "rising") {
      return (inv.variation_pct ?? 0) >= VARIATION_ALERT_PCT;
    }
    if (filter === "this_month") {
      const d = new Date(inv.invoice_date);
      return !isNaN(d.getTime()) && d >= monthStart;
    }
    return true;
  });

  const chips: { key: InvoiceFilter; label: string }[] = [
    { key: "all", label: "Tout" },
    { key: "rising", label: "En hausse ↗" },
    { key: "this_month", label: "Ce mois" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-slate-900 font-semibold text-base">Bons de Livraison</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenGallery}
            className="text-slate-400 hover:text-blue-600 transition-colors text-xs flex items-center gap-1 font-medium"
            title="Importer une facture déjà prise en photo"
            aria-label="Importer une facture déjà prise en photo"
          >
            <FolderOpen size={13} /> Importer
          </button>
          <button
            onClick={onOpenCamera}
            className="label-blue text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1"
            aria-label="Scanner un nouveau bon de livraison"
          >
            <Camera size={12} /> Scanner
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-3 -mx-1 overflow-x-auto px-1 scrollbar-none">
        {chips.map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => onFilterChange(c.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5">
        {provisionalCards.map((item) => (
          <ProvisionalInvoiceCard
            key={item.id}
            item={item}
            onRetry={(id) => onRetryProvisional?.(id)}
            onDismiss={(id) => onDismissProvisional?.(id)}
          />
        ))}
        {filtered.length === 0
          ? provisionalCards.length === 0 && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-5 text-center">
                <p className="text-slate-400 text-xs">Aucune facture ne correspond à ce filtre.</p>
              </div>
            )
          : filtered.map((inv) => (
              <InvoiceCard
                key={inv.id}
                inv={inv}
                onClick={inv.status === "processed" ? () => onInvoiceClick(inv.id) : undefined}
                onDismiss={() => onInvoiceDismiss(inv.id)}
                onCreateRecipe={
                  onCreateRecipeFromInvoice && inv.status === "processed"
                    ? () => onCreateRecipeFromInvoice(inv.id)
                    : undefined
                }
              />
            ))}
      </div>
    </motion.div>
  );
}
