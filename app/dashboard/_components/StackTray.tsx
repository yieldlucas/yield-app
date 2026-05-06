"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Camera, CheckCircle2, FileText, HelpCircle, Layers, X } from "lucide-react";
import { type StackItem } from "@/lib/scan-stack";

/**
 * Drawer fixé en bas de l'écran, n'apparaît que si le stack contient des items.
 * Affiche les thumbnails + un CTA "Envoyer le lot (N)". Chaque thumbnail a un
 * bouton "x" pour retirer une photo.
 *
 * Génère les blob URLs à chaque rendu et les nettoie via le cleanup du
 * useEffect — ça évite tout risque de fuite. Le stack est rarement gros
 * (< 20 photos en pratique) donc le coût est négligeable.
 */
export function StackTray({
  items,
  onSend,
  onRemove,
  onClearAll,
  onAddMore,
  onShowGuide,
  busy,
}: {
  items: StackItem[];
  onSend: () => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onAddMore: () => void;
  onShowGuide: () => void;
  busy: boolean;
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const it of items) {
      if (it.file.type.startsWith("image/")) {
        map[it.id] = URL.createObjectURL(it.file);
      }
    }
    setPreviews(map);
    return () => {
      Object.values(map).forEach(URL.revokeObjectURL);
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-xl"
    >
      <div className="max-w-lg mx-auto px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-blue-600" />
            <p className="text-slate-900 font-semibold text-sm">
              {items.length} {items.length > 1 ? "photos prêtes" : "photo prête"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onShowGuide}
              disabled={busy}
              className="text-slate-400 hover:text-blue-600 text-xs font-medium flex items-center gap-1 disabled:opacity-30"
              title="Conseils de cadrage"
            >
              <HelpCircle size={12} /> Aide
            </button>
            <button
              onClick={onClearAll}
              disabled={busy}
              className="text-slate-400 hover:text-rose-500 text-xs font-medium disabled:opacity-30"
            >
              Tout supprimer
            </button>
          </div>
        </div>

        {/* Thumbnails horizontales */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-none">
          {items.map((it) => (
            <div key={it.id} className="relative flex-shrink-0">
              {previews[it.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews[it.id]}
                  alt={it.fileName}
                  className="w-16 h-20 object-cover rounded-lg border border-slate-200"
                />
              ) : (
                <div className="w-16 h-20 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                  <FileText size={20} className="text-slate-400" />
                </div>
              )}
              {!busy && (
                <button
                  onClick={() => onRemove(it.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md hover:bg-rose-500"
                  aria-label="Retirer cette photo"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          {/* Tile "+" pour ajouter une photo de plus */}
          {!busy && (
            <button
              onClick={onAddMore}
              className="flex-shrink-0 w-16 h-20 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 flex flex-col items-center justify-center gap-0.5"
              aria-label="Ajouter une photo"
            >
              <Camera size={16} />
              <span className="text-[10px] font-medium">Ajouter</span>
            </button>
          )}
        </div>

        <button
          onClick={onSend}
          disabled={busy}
          className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <CheckCircle2 size={16} />
              Envoyer le lot ({items.length})
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
