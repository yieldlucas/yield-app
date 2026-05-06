"use client";

import { motion } from "framer-motion";
import { Camera } from "lucide-react";

/**
 * Sas d'instructions visuel AVANT d'ouvrir la caméra native.
 *
 * Pourquoi : l'app caméra native du téléphone gère mieux que `<video>` +
 * `getUserMedia` (autofocus, balance des blancs, HDR), donc on ne peut pas
 * dessiner un overlay PAR-DESSUS la caméra système. À la place : ce modal
 * s'affiche à la 1ère utilisation pour que le chef cadre bien sa facture du
 * premier coup. Re-affichable à la demande via le bouton "?" du tray.
 */
export function CameraGuide({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-slate-900 font-bold text-lg mb-1">Cadrez votre facture</h2>
        <p className="text-slate-500 text-sm mb-5">
          Une bonne photo = une lecture parfaite. Posez le BL sur fond uni et restez à plat.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* OK : facture droite, bien cadrée */}
          <div className="flex flex-col items-center">
            <div className="w-full aspect-[3/4] rounded-xl border-4 border-emerald-500 bg-emerald-50 flex items-center justify-center p-3 mb-2">
              <svg viewBox="0 0 60 80" className="w-full h-full">
                <rect x="10" y="8" width="40" height="64" rx="2" fill="white" stroke="#10b981" strokeWidth="1.5" />
                <line x1="16" y1="20" x2="44" y2="20" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="16" y1="28" x2="44" y2="28" stroke="#cbd5e1" strokeWidth="1" />
                <line x1="16" y1="36" x2="44" y2="36" stroke="#cbd5e1" strokeWidth="1" />
                <line x1="16" y1="44" x2="44" y2="44" stroke="#cbd5e1" strokeWidth="1" />
                <line x1="16" y1="52" x2="44" y2="52" stroke="#cbd5e1" strokeWidth="1" />
                <line x1="16" y1="60" x2="36" y2="60" stroke="#cbd5e1" strokeWidth="1" />
              </svg>
            </div>
            <p className="text-emerald-700 text-xs font-semibold text-center">✓ Droite et entière</p>
          </div>

          {/* KO : facture de travers, coupée */}
          <div className="flex flex-col items-center">
            <div className="w-full aspect-[3/4] rounded-xl border-4 border-rose-500 bg-rose-50 flex items-center justify-center p-3 mb-2 overflow-hidden">
              <svg viewBox="0 0 60 80" className="w-full h-full">
                <g transform="rotate(-18 30 40)">
                  <rect x="14" y="10" width="40" height="64" rx="2" fill="white" stroke="#f43f5e" strokeWidth="1.5" />
                  <line x1="20" y1="22" x2="48" y2="22" stroke="#94a3b8" strokeWidth="1.5" />
                  <line x1="20" y1="30" x2="48" y2="30" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1="20" y1="38" x2="48" y2="38" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1="20" y1="46" x2="48" y2="46" stroke="#cbd5e1" strokeWidth="1" />
                </g>
              </svg>
            </div>
            <p className="text-rose-700 text-xs font-semibold text-center">✗ Inclinée ou coupée</p>
          </div>
        </div>

        <ul className="text-slate-600 text-sm space-y-1.5 mb-5">
          <li className="flex gap-2"><span className="text-emerald-500">•</span> Lumière du jour ou plafonnier (pas de flash)</li>
          <li className="flex gap-2"><span className="text-emerald-500">•</span> Toute la facture dans le cadre, marges incluses</li>
          <li className="flex gap-2"><span className="text-emerald-500">•</span> Téléphone parallèle à la table</li>
        </ul>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-[2] px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-blue-lg flex items-center justify-center gap-2"
          >
            <Camera size={16} /> J'y vais
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
