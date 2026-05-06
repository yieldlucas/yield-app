"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { type Alert } from "./types";

/**
 * Carte récap "Bilan Matière" en haut du dashboard quand au moins une alerte
 * existe. Met en avant la pire dérive de prix de la liste.
 */
export function BilanMatiere({
  unreadCount,
  totalRecipesAffected,
  biggestSpike,
}: {
  unreadCount: number;
  totalRecipesAffected: number;
  biggestSpike: Alert | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <div
        className="rounded-2xl p-5 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #1D4ED8, #2563EB 50%, #4F46E5)" }}
      >
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.12) 0%, transparent 60%)" }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-blue-200" />
            <span className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Bilan Matière</span>
          </div>
          <p className="text-2xl font-bold mb-1">
            {unreadCount} alerte{unreadCount > 1 ? "s" : ""} rendement
          </p>
          <p className="text-blue-200 text-sm mb-4">
            {totalRecipesAffected} fiche{totalRecipesAffected > 1 ? "s" : ""} technique{totalRecipesAffected > 1 ? "s" : ""} à ajuster avant le prochain service
          </p>
          {biggestSpike && (
            <div className="flex items-center justify-between pt-3 border-t border-white/15">
              <div className="min-w-0">
                <p className="text-blue-200 text-[10px] uppercase tracking-wider font-semibold mb-0.5">
                  Pire dérive
                </p>
                <p className="text-white text-sm font-semibold truncate">{biggestSpike.product_name}</p>
              </div>
              <span className="font-mono font-bold text-white bg-white/10 px-2.5 py-1 rounded-lg text-sm flex-shrink-0">
                +{biggestSpike.price_change_pct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
