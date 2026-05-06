"use client";

import { motion } from "framer-motion";
import { Camera } from "lucide-react";

/**
 * FAB (Floating Action Button) pour lancer un scan. Affiché en bas à droite,
 * caché si `show` est false (par exemple quand le stack tray est visible).
 */
export function ScannerFAB({ onClick, show }: { onClick: () => void; show: boolean }) {
  if (!show) return null;
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-5 z-30 btn-primary rounded-2xl flex items-center gap-3 px-5 py-4 shadow-blue-lg"
      aria-label="Scanner un bon de livraison"
    >
      <Camera size={22} className="text-white" />
      <span className="text-white font-bold text-sm">Scanner un BL</span>
    </motion.button>
  );
}
