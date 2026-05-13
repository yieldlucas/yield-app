"use client";

// Petit moment de joie quand le chef réussit son tout premier scan.
// Un seul affichage à vie via localStorage — c'est un moment fondateur,
// pas un toast qu'on voit toutes les semaines.
//
// Déclenché par le caller quand `invoices.length` passe de 0 → 1.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Sparkles, X } from "lucide-react";

const STORAGE_KEY = "yield_first_scan_celebrated";

export function FirstScanCelebration({ show, onDismiss }: {
  show: boolean;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    setVisible(true);
    localStorage.setItem(STORAGE_KEY, "1");
    // Auto-dismiss après 6s pour laisser le chef savourer sans devoir cliquer.
    const t = window.setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 6000);
    return () => window.clearTimeout(t);
  }, [show, onDismiss]);

  const close = () => {
    setVisible(false);
    onDismiss();
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop : assombrit le fond, focus total sur le moment. Click
              au fond ferme le toast (sans interrompre le polling derrière). */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-slate-900/40 backdrop-blur-sm"
            onClick={close}
          />
          {/* Toast centré écran. Position : top-1/2 + translate-y-1/2 garantit
              le centrage parfait quel que soit la hauteur du contenu, vs
              bottom-6 qui pouvait se faire bouffer par la safe-area iOS. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -8 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-5 pointer-events-none"
          >
            <div
              className="rounded-3xl shadow-2xl overflow-hidden text-white relative w-full max-w-sm pointer-events-auto"
              style={{ background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 60%, #7C3AED 100%)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Halos décoratifs */}
              <div aria-hidden className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
              <div aria-hidden className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />

              <div className="relative px-6 py-7">
                <button
                  onClick={close}
                  className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors p-1"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>

                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Sparkles size={28} className="text-white" />
                </div>

                <h3 className="font-bold text-xl text-center leading-tight mb-2">
                  Premier scan validé 🎉
                </h3>
                <p className="text-white/90 text-sm text-center leading-relaxed mb-5">
                  Vos prix sont désormais à jour. À chaque livraison, scannez le BL —
                  Yield surveille le reste pour vous.
                </p>

                <div className="rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 px-3 py-2.5 flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-white flex-shrink-0 mt-0.5" />
                  <p className="text-white/95 text-[12px] leading-relaxed">
                    <strong>Conseil de Lucas :</strong> la 1ère semaine, scannez
                    tous vos BL pour bâtir votre historique.
                  </p>
                </div>

                <button
                  onClick={close}
                  className="w-full mt-5 py-2.5 rounded-xl bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-colors"
                >
                  C&apos;est parti
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
