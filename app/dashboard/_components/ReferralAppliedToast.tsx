"use client";

// Toast affiché quand la RPC apply_referral_code vient de créditer le filleul.
// Centre écran, gradient emerald (positif/cadeau), auto-dismiss 6s.
// Différent du FirstScanCelebration (bleu/violet, autre moment) pour que
// le chef distingue clairement "bonus reçu" vs "premier scan validé".

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, X } from "lucide-react";

export function ReferralAppliedToast({
  daysCredited,
  onDismiss,
}: {
  daysCredited: number | null;
  onDismiss: () => void;
}) {
  // Auto-dismiss après 6s. Pas de localStorage : le state vit dans la page
  // dashboard, le toast n'apparait qu'au moment exact de l'application RPC.
  useEffect(() => {
    if (daysCredited == null) return;
    const t = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(t);
  }, [daysCredited, onDismiss]);

  return (
    <AnimatePresence>
      {daysCredited != null && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-slate-900/40 backdrop-blur-sm pointer-events-none"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -8 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-5 pointer-events-none"
          >
            <div
              className="rounded-3xl shadow-2xl overflow-hidden text-white relative w-full max-w-sm pointer-events-auto"
              style={{ background: "linear-gradient(135deg, #059669 0%, #0891B2 60%, #2563EB 100%)" }}
            >
              <div aria-hidden className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
              <div aria-hidden className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />

              <div className="relative px-6 py-7">
                <button
                  onClick={onDismiss}
                  className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors p-1"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>

                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Gift size={28} className="text-white" />
                </div>

                <h3 className="font-bold text-xl text-center leading-tight mb-2">
                  Bienvenue ! 🎁
                </h3>
                <p className="text-white/95 text-sm text-center leading-relaxed mb-5">
                  Vous avez été parrainé : <strong>{daysCredited} jours d&apos;essai
                  supplémentaires</strong> ont été ajoutés à votre compte.
                </p>
                <div className="rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 px-3 py-2.5 text-center">
                  <p className="text-white/95 text-[12px] leading-relaxed">
                    Aucune carte bancaire requise. Profitez tranquillement de
                    votre essai prolongé pour découvrir Yield.
                  </p>
                </div>

                <button
                  onClick={onDismiss}
                  className="w-full mt-5 py-2.5 rounded-xl bg-white text-emerald-700 font-semibold text-sm hover:bg-emerald-50 transition-colors"
                >
                  Commencer
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
