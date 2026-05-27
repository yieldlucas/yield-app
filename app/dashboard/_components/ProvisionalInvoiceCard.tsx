"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Clock, RotateCcw, X } from "lucide-react";
import { type BatchItem } from "./types";

/**
 * Carte provisoire d'un scan en cours, affichée en haut de la timeline dès le
 * clic "Envoyer le lot" — avant même que la ligne `invoices` n'existe côté DB.
 * Donne au chef un feedback immédiat ("ça travaille") plutôt qu'un écran qui
 * semble figé pendant les ~25-30s d'analyse par facture.
 *
 * États (cf. spec) :
 *  - queued     → gris, "En file d'attente"
 *  - uploading  → gris + spinner, "Envoi en cours…"
 *  - processing → gris + spinner, label dynamique calé sur processing_step
 *  - error      → rouge, "Lecture impossible" + "Réessayer" (+ écarter)
 *  - done       → JAMAIS rendu ici : la vraie carte facture (DB) prend le relais.
 */
function processingLabel(item: BatchItem): string {
  switch (item.processingStep) {
    case "extracting":
      return "Lecture des lignes…";
    case "matching":
      return item.totalItemsCount
        ? `Analyse des ${item.totalItemsCount} produits…`
        : "Analyse des produits…";
    case "alerting":
      return "Calcul des marges…";
    default:
      return "Analyse en cours…";
  }
}

export function ProvisionalInvoiceCard({
  item,
  onRetry,
  onDismiss,
}: {
  item: BatchItem;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const isError = item.status === "error";
  const inFlight = item.status === "uploading" || item.status === "processing";

  const label =
    item.status === "queued"
      ? "En file d'attente"
      : item.status === "uploading"
        ? "Envoi en cours…"
        : item.status === "processing"
          ? processingLabel(item)
          : "Lecture impossible";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={`relative w-full rounded-xl border p-4 ${
        isError ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-200"
      }`}
    >
      {isError && (
        <button
          onClick={() => onDismiss(item.id)}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/70 hover:bg-rose-100 hover:text-rose-500 text-slate-400 flex items-center justify-center transition-colors"
          aria-label="Écarter cette facture"
          title="Écarter cette facture"
        >
          <X size={12} />
        </button>
      )}

      <div className="flex items-center gap-3">
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
          {isError ? (
            <AlertTriangle size={16} className="text-rose-500" />
          ) : inFlight ? (
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          ) : (
            <Clock size={15} className="text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className={`text-sm font-semibold truncate ${isError ? "text-rose-600" : "text-slate-700"}`}>
            {label}
          </p>
          <p className={`text-xs mt-0.5 truncate ${isError ? "text-rose-400" : "text-slate-400"}`}>
            {isError ? (item.error ?? "Réessayez avec une photo plus nette.") : "Bon de livraison"}
          </p>
        </div>
        {isError && (
          <button
            onClick={() => onRetry(item.id)}
            className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-full transition-colors"
          >
            <RotateCcw size={12} /> Réessayer
          </button>
        )}
      </div>

      {inFlight && (
        <div className="mt-3 h-0.5 w-full bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: "10%" }}
            animate={{ width: ["10%", "55%", "85%", "10%"] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          />
        </div>
      )}
    </motion.div>
  );
}
