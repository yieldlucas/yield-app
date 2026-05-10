"use client";

import { motion } from "framer-motion";
import { ChefHat, X } from "lucide-react";
import { type RecentInvoice, VARIATION_ALERT_PCT } from "./types";

/**
 * Formate une date de facture en français selon sa proximité :
 *   - aujourd'hui J  → "Aujourd'hui, 14:30"
 *   - hier      J-1  → "Hier, 14:30"
 *   - même année     → "28 avril"
 *   - autre année    → "28 avril 2025"
 *
 * Tolérant : si `raw` n'est pas parseable, retourne tel quel pour éviter un
 * "Invalid Date" qui surprendrait le chef.
 */
function formatInvoiceDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (isSameDay(d, now)) return `Aujourd'hui, ${time}`;
  if (isSameDay(d, yesterday)) return `Hier, ${time}`;
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  }
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Pastille colorée d'évolution de prix (↗ ↘ →). */
function VariationBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-400 border border-slate-100">
        —
      </span>
    );
  }
  const tone = pct >= VARIATION_ALERT_PCT
    ? "bg-rose-50 text-rose-600 border-rose-100"
    : pct < 0
      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
      : "bg-slate-50 text-slate-500 border-slate-100";
  const arrow = pct >= VARIATION_ALERT_PCT ? "↗" : pct < 0 ? "↘" : "→";
  const sign = pct > 0 ? "+" : "";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border tabular-nums ${tone}`}>
      {arrow} {sign}{pct.toFixed(1)}%
    </span>
  );
}

/**
 * Carte timeline d'un BL. États : processing/error/duplicate/processed.
 * - processing : barre animée + label dynamique (extracting / matching / alerting)
 * - error/duplicate : pastille + bouton X pour retirer la card
 * - processed : montant HT + VariationBadge, cliquable vers le détail
 */
export function InvoiceCard({
  inv,
  onClick,
  onDismiss,
  onCreateRecipe,
}: {
  inv: RecentInvoice;
  onClick?: () => void;
  onDismiss?: () => void;
  /** Si fourni, affiche un bouton "Créer une recette" sur les factures
   *  processed — ouvre la calculatrice pré-remplie avec les lignes du BL. */
  onCreateRecipe?: () => void;
}) {
  const isProcessing = inv.status === "processing" || inv.status === "pending";
  const isError = inv.status === "error";
  const isDuplicate = inv.status === "duplicate";

  const stepLabel = inv.processing_step === "extracting"
    ? "Lecture des lignes..."
    : inv.processing_step === "matching"
      ? "Analyse des produits..."
      : inv.processing_step === "alerting"
        ? "Calcul des marges..."
        : "Analyse en cours...";

  // Bouton X sur les cards qui n'apportent rien (error/duplicate) — permet
  // au chef de nettoyer sa timeline sans passer par du SQL.
  const dismissButton = onDismiss && (isError || isDuplicate) ? (
    <button
      onClick={(e) => { e.stopPropagation(); onDismiss(); }}
      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-50 hover:bg-rose-50 hover:text-rose-500 text-slate-400 flex items-center justify-center transition-colors"
      aria-label="Retirer cette facture"
      title="Retirer cette facture"
    >
      <X size={12} />
    </button>
  ) : null;

  // Le content est extrait pour le réutiliser dans button OU div selon
  // qu'on est cliquable ou pas (HTML interdit button-dans-button).
  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-slate-900 text-base font-bold truncate leading-tight">
            {inv.supplier_name || "Fournisseur inconnu"}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {formatInvoiceDate(inv.invoice_date)}{inv.items_count ? ` · ${inv.items_count} produits` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isProcessing ? (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-[11px] font-medium">{stepLabel}</span>
            </div>
          ) : isError ? (
            // Pastille courte + tooltip avec le message précis (PDF non
            // supporté, image floue, etc.) écrit par l'edge function.
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-100"
              title={inv.error_message ?? "Lecture impossible"}
            >
              Lecture impossible
            </span>
          ) : isDuplicate ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
              Doublon
            </span>
          ) : (
            <>
              <p className="text-slate-900 text-base font-semibold tabular-nums leading-none">
                {inv.total_ht != null
                  ? `${inv.total_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                  : "—"}
              </p>
              <VariationBadge pct={inv.variation_pct} />
            </>
          )}
        </div>
      </div>
      {isProcessing && (
        <div className="mt-3 h-0.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: "10%" }}
            animate={{ width: ["10%", "55%", "85%", "10%"] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          />
        </div>
      )}
      {/* Footer micro-action : transformer cette facture en composition recette.
          Affiché uniquement quand la facture est processed (sinon pas de lignes
          exploitables) et que le caller a fourni un handler. */}
      {onCreateRecipe && !isProcessing && !isError && !isDuplicate && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onCreateRecipe(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onCreateRecipe();
              }
            }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full transition-colors cursor-pointer select-none"
            title="Composer une recette à partir de ces lignes"
          >
            <ChefHat size={11} />
            Créer une recette
          </span>
        </div>
      )}
    </>
  );

  const baseClass = "relative w-full text-left rounded-xl bg-white shadow-sm border border-slate-100 p-4 transition-all";

  if (onClick && !isProcessing) {
    return (
      <button onClick={onClick} className={`${baseClass} hover:border-slate-200 hover:shadow`}>
        {dismissButton}
        {content}
      </button>
    );
  }

  return (
    <div className={baseClass}>
      {dismissButton}
      {content}
    </div>
  );
}
