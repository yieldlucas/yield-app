"use client";

import { motion } from "framer-motion";
import { CalendarClock, Mail, Sparkles } from "lucide-react";

/**
 * Modal d'information quand le quota mensuel (Lancement = 200 scans) est
 * atteint. Pas de blocage strict : le user voit que le compteur se réinitialise
 * au 1er du mois prochain, et qu'un forfait Pro illimité est en préparation.
 *
 * Le forfait Pro n'étant pas encore wired dans Stripe, on n'expose pas de
 * bouton de checkout — un mailto permet de manifester son intérêt et d'être
 * prévenu en avant-première lors de l'ouverture du Pro.
 */
export function QuotaExceededModal({
  open,
  quota,
  onClose,
}: {
  open: boolean;
  quota: number;
  onClose: () => void;
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
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          Vous avez utilisé vos <strong>{quota} scans</strong> inclus dans le forfait Lancement
          ce mois-ci. C&apos;est le signe d&apos;une cuisine très active.
        </p>

        {/* Reset mensuel : info clé, encadrée pour la mettre en avant */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 mb-4 flex items-start gap-2.5">
          <CalendarClock size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-[13px] text-slate-700 leading-relaxed">
            <strong className="text-slate-900">Quota réinitialisé le 1er du mois prochain.</strong>
            {" "}Aucune action requise.
          </div>
        </div>

        {/* Teaser Pro à venir — honnête sur le statut "en préparation" */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Bientôt — Forfait Pro
          </p>
          <p className="text-[12px] text-slate-600 leading-relaxed mb-2">
            Scans illimités, espace comptable (export Sage/EBP, écarts fournisseur,
            multi-établissements). <strong>39,99 € HT/mois.</strong>
          </p>
          <a
            href="mailto:chef@yieldapp.fr?subject=Liste%20d'attente%20Forfait%20Pro&body=Bonjour%20Lucas%2C%20je%20suis%20int%C3%A9ress%C3%A9%20par%20le%20futur%20forfait%20Pro%20de%20Yield."
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-700 hover:text-blue-800"
          >
            <Mail size={11} /> Me prévenir à l&apos;ouverture
          </a>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors"
        >
          Compris, j&apos;attends le mois prochain
        </button>
      </motion.div>
    </motion.div>
  );
}
