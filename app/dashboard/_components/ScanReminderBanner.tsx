"use client";

// Nudge discret : si le chef a peu scanné cette semaine, on lui rappelle que
// ses prix datent. Pas un blocage, pas une notif intempestive — juste un
// bandeau bleu pâle facile à dismisser.
//
// Trigger : < seuil de scans sur 7 jours glissants. Le seuil est conservateur
// pour ne pas déclencher chez un user actif qui a un dimanche calme.

import { motion } from "framer-motion";
import { Calendar, X } from "lucide-react";

const STORAGE_KEY = "yield_scan_reminder_dismissed_at";
/** Délai de re-trigger après dismiss : 3 jours. Au-delà, on re-propose
 *  pour ne pas laisser un chef en silence avec des prix obsolètes. */
const REDISMISS_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export function ScanReminderBanner({
  recentScans,
  threshold = 3,
  totalInvoices,
  onDismiss,
}: {
  recentScans: number;
  threshold?: number;
  totalInvoices: number;
  onDismiss: () => void;
}) {
  // Caché si l'user n'a aucune facture (empty state primaire) OU si scans
  // suffisants OU si dismissé récemment.
  if (totalInvoices === 0) return null;
  if (recentScans >= threshold) return null;
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY);
    const dismissedAt = raw ? parseInt(raw, 10) : 0;
    if (Date.now() - dismissedAt < REDISMISS_AFTER_MS) return null;
  }

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-xl bg-white border border-blue-100 flex items-center justify-center flex-shrink-0">
        <Calendar size={16} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 font-semibold text-sm leading-tight">
          {recentScans === 0
            ? "Vous n'avez rien scanné cette semaine."
            : `Seulement ${recentScans} BL scanné${recentScans > 1 ? "s" : ""} ces 7 derniers jours.`}
        </p>
        <p className="text-slate-500 text-[12px] leading-relaxed mt-0.5">
          Vos prix datent. Un BL non scanné = une hausse fournisseur potentiellement
          invisible. Photographiez vos prochaines livraisons à réception.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="text-slate-300 hover:text-slate-600 transition-colors p-0.5 flex-shrink-0"
        aria-label="Masquer ce rappel"
        title="Masquer 3 jours"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
