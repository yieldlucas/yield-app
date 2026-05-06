"use client";

import { motion } from "framer-motion";
import { ChevronRight, Crown, X } from "lucide-react";

/**
 * Bandeau d'invitation à démarrer l'essai gratuit (Stripe Checkout).
 * Caché si l'user a déjà cliqué "X" (flag localStorage `yield_trial_dismissed`)
 * ou s'il est déjà abonné. Le clic CTA déclenche `onStart` (qui ouvre la
 * session Stripe Checkout).
 */
export function TrialBanner({
  show,
  onStart,
  onDismiss,
  loading,
}: {
  show: boolean;
  onStart: () => void;
  onDismiss: () => void;
  loading: boolean;
}) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 text-white relative overflow-hidden"
      style={{ background: "linear-gradient(145deg, #1D4ED8, #2563EB 50%, #4F46E5)" }}
    >
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 80% 30%, rgba(255,255,255,0.14) 0%, transparent 60%)" }} />
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
        aria-label="Fermer"
      >
        <X size={16} />
      </button>
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Crown size={14} className="text-blue-200" />
          <span className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Essai gratuit</span>
        </div>
        <p className="text-lg font-bold mb-1">14 jours offerts</p>
        <p className="text-blue-100 text-sm mb-4">
          Scans illimités, alertes temps réel, conciergerie chef. Sans engagement, résiliable en 1 clic.
        </p>
        <button
          onClick={onStart}
          disabled={loading}
          className="w-full bg-white text-blue-700 font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors disabled:opacity-70"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin" />
              Ouverture du paiement…
            </>
          ) : (
            <>Démarrer l&apos;essai <ChevronRight size={15} /></>
          )}
        </button>
      </div>
    </motion.div>
  );
}
