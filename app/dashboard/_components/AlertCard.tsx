"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, TrendingDown, X } from "lucide-react";
import { type Alert } from "./types";

/**
 * Carte d'alerte rendement. Affiche le produit, la variation %, l'ancien et
 * le nouveau prix, et expand au clic pour montrer les fiches recettes
 * impactées (avec leur perte de marge en points).
 *
 * `onDismiss` (optionnel) → bouton X qui marque l'alerte lue.
 */
export function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isHigh = Math.abs(alert.price_change_pct) >= 10;
  const priceDelta = alert.new_price - alert.old_price;
  const sign = priceDelta >= 0 ? "+" : "−";

  return (
    <motion.div
      layout
      onClick={() => setExpanded((v) => !v)}
      className={`relative card rounded-2xl p-4 cursor-pointer card-hover border-l-4 ${isHigh ? "border-red-400" : "border-blue-400"}`}
    >
      {onDismiss && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-50 hover:bg-rose-50 hover:text-rose-500 text-slate-400 flex items-center justify-center transition-colors"
          aria-label="Marquer comme lue"
          title="Marquer comme lue"
        >
          <X size={12} />
        </button>
      )}
      <div className="flex items-start gap-3 pr-6">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isHigh ? "bg-red-50" : "bg-blue-50"}`}>
          <TrendingDown size={16} className={isHigh ? "text-red-500" : "text-blue-600"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-slate-800 font-semibold text-sm truncate">{alert.product_name}</p>
            <span className={`text-xs font-bold font-mono flex-shrink-0 px-2 py-0.5 rounded-lg ${isHigh ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-600"}`}>
              +{alert.price_change_pct.toFixed(1)}%
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {alert.old_price.toFixed(2)}€ → {alert.new_price.toFixed(2)}€
            <span className={`ml-1.5 font-mono font-semibold ${isHigh ? "text-red-500" : "text-blue-600"}`}>
              ({sign}{Math.abs(priceDelta).toFixed(2)}€/unité)
            </span>
          </p>
        </div>
        <ChevronRight size={16} className={`text-slate-300 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </div>

      <AnimatePresence>
        {expanded && alert.affected_recipes?.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                {alert.affected_recipes.length} fiche{alert.affected_recipes.length > 1 ? "s" : ""} à ajuster
              </p>
              {alert.affected_recipes.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{r.name}</span>
                  <span className={`font-mono font-semibold ${r.margin_impact_pts >= 2 ? "text-red-500" : "text-blue-600"}`}>
                    −{Math.abs(r.margin_impact_pts).toFixed(1)} pts de marge
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
