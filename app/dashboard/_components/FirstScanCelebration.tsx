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
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-sm w-[calc(100%-2rem)]"
        >
          <div
            className="rounded-2xl shadow-2xl overflow-hidden text-white"
            style={{ background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 60%, #7C3AED 100%)" }}
          >
            {/* Halo décoratif */}
            <div aria-hidden className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />

            <div className="relative px-5 py-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Sparkles size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-tight mb-0.5">
                  Premier scan validé 🎉
                </p>
                <p className="text-white/85 text-[13px] leading-snug">
                  Vos prix sont désormais à jour. À chaque livraison, scannez le BL —
                  Yield surveille le reste pour vous.
                </p>
                <div className="mt-2.5 flex items-center gap-1.5 text-white/90 text-[11px] font-medium">
                  <CheckCircle2 size={12} />
                  Conseil : la 1ère semaine, scannez tous vos BL pour bâtir votre historique.
                </div>
              </div>
              <button
                onClick={close}
                className="text-white/70 hover:text-white transition-colors p-0.5 flex-shrink-0"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
