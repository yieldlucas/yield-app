"use client";

import { motion } from "framer-motion";
import { Camera, ChevronRight, FolderOpen } from "lucide-react";

/**
 * État vide du dashboard : grand bouton de scan + lien d'import.
 * Affiché uniquement quand `invoices.length === 0`.
 */
export function EmptyScanCTA({
  onOpenCamera,
  onOpenGallery,
}: {
  onOpenCamera: () => void;
  onOpenGallery: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
    >
      <button
        onClick={onOpenCamera}
        className="w-full card rounded-3xl p-8 text-center card-hover border-2 border-dashed border-blue-200 hover:border-blue-400 transition-colors"
      >
        <div className="w-16 h-16 btn-primary rounded-2xl flex items-center justify-center mx-auto mb-4 glow-blue-sm">
          <Camera size={32} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Scanner mon bon de livraison</h2>
        <p className="text-slate-500 text-sm">
          Photographiez votre bon de livraison. L&apos;IA calcule l&apos;impact matière en 30 secondes.
        </p>
        <div className="mt-5 flex items-center justify-center gap-1.5 text-blue-600 text-sm font-semibold">
          Commencer <ChevronRight size={16} />
        </div>
      </button>
      <button
        onClick={onOpenGallery}
        className="w-full mt-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5"
      >
        <FolderOpen size={14} /> Importer un fichier (anciennes factures)
      </button>
    </motion.div>
  );
}
