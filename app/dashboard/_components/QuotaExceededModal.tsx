"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * Modal d'upsell quand le quota mensuel est atteint. Pas un blocage strict
 * (le user n'est pas en dette), juste une invitation à passer au Pro.
 * Cliquer en dehors ou sur "Plus tard" la ferme. "Découvrir le Pro" déclenche
 * un Stripe Checkout vers le plan supérieur.
 */
export function QuotaExceededModal({
  open,
  quota,
  onClose,
  onCheckout,
}: {
  open: boolean;
  quota: number;
  onClose: () => void;
  onCheckout: () => void;
}) {
  if (!open) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
          <Sparkles size={22} className="text-blue-600" />
        </div>
        <h2 className="text-slate-900 font-bold text-lg mb-2">
          Vous scannez beaucoup — bravo !
        </h2>
        <p className="text-slate-600 text-sm leading-relaxed mb-2">
          Vous avez utilisé vos <strong>{quota} scans</strong> inclus dans le forfait Lancement ce mois-ci.
          C&apos;est le signe d&apos;une cuisine très active.
        </p>
        <p className="text-slate-600 text-sm leading-relaxed mb-5">
          Pour continuer à scanner sans limite jusqu&apos;à la fin du mois et débloquer les outils Business
          Intelligence (détection d&apos;écarts fournisseur, export comptable Sage/EBP, alertes marge cassée
          en temps réel), passez au forfait <strong>Pro à 39,99€/mois</strong>.
        </p>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-5">
          <p className="text-slate-500 text-xs leading-relaxed">
            Le quota se réinitialise automatiquement le 1er du mois prochain. Aucune action requise si vous
            préférez attendre.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm"
          >
            Plus tard
          </button>
          <button
            onClick={() => { onClose(); onCheckout(); }}
            className="flex-[2] px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-blue-lg flex items-center justify-center gap-2"
          >
            <Sparkles size={16} /> Découvrir le Pro
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
