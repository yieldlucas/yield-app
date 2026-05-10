"use client";

import { motion } from "framer-motion";
import { Calculator, ChevronRight, Sparkles } from "lucide-react";

/**
 * Carte d'entrée vers la calculatrice de marge — affichée en haut du dashboard,
 * toujours visible (avec ou sans factures) pour mettre en avant la fonction.
 *
 * Le clic ouvre le drawer FlashCalculator, dont le state vit dans la page
 * (lifted) — d'où le simple callback `onOpen`.
 */
export function CalculatorCard({ onOpen }: { onOpen: () => void }) {
  return (
    <motion.button
      onClick={onOpen}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      className="w-full text-left rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-50/50 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
      aria-label="Ouvrir la calculatrice de marge"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
          <Calculator size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={12} className="text-blue-500" />
            <span className="text-blue-600 text-[10px] font-bold uppercase tracking-wider">
              Pilotage de marge
            </span>
          </div>
          <h2 className="text-slate-900 font-bold text-base leading-tight mb-1">
            Calculatrice de Marge
          </h2>
          <p className="text-slate-500 text-[13px] leading-snug">
            Composez votre recette, testez la rentabilité d&apos;un nouveau plat
            et obtenez le prix de vente conseillé en 30 secondes.
          </p>
        </div>
        <ChevronRight size={18} className="text-blue-400 flex-shrink-0 mt-1" />
      </div>
    </motion.button>
  );
}
