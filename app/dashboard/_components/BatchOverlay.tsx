"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Camera, CheckCircle2, ChefHat } from "lucide-react";
import { type BatchItem } from "./types";

/**
 * Message dynamique pour une ligne en cours d'analyse, calé sur
 * `processing_step` remonté par le polling. Donne au chef l'impression d'un
 * vrai travail en cours pendant les ~15-25s d'analyse Claude.
 */
function stepMessage(item: BatchItem): string {
  if (item.status === "uploading") return "Envoi de la photo...";
  if (item.status !== "processing") return "";
  switch (item.processingStep) {
    case "extracting":
      return "Lecture des lignes de la facture...";
    case "matching":
      return item.totalItemsCount
        ? `Analyse des ${item.totalItemsCount} produits détectés...`
        : "Analyse des produits détectés...";
    case "alerting":
      return "Calcul de l'impact sur vos marges...";
    default:
      return "Analyse en cours...";
  }
}

/**
 * Overlay plein écran montrant la progression d'un lot de scans.
 * Affiche la liste des items (status par item) + un CTA final "Voir les
 * résultats". Si certains scans ont échoué, propose un bouton "Reprendre".
 */
export function BatchOverlay({
  items,
  open,
  onClose,
  onRetake,
}: {
  items: BatchItem[];
  open: boolean;
  onClose: () => void;
  onRetake: () => void;
}) {
  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const errored = items.filter((i) => i.status === "error").length;
  const current = items.find((i) => i.status === "uploading" || i.status === "processing");
  const allFinished = total > 0 && items.every((i) => i.status === "done" || i.status === "error");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-center p-5"
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            className="card rounded-3xl p-7 max-w-sm w-full shadow-card"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="relative w-12 h-12 flex-shrink-0">
                <div className="absolute inset-0 rounded-2xl btn-primary flex items-center justify-center">
                  <ChefHat size={22} className="text-white" />
                </div>
                {!allFinished && (
                  <svg className="absolute inset-0 animate-spin-slow" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" stroke="rgba(37,99,235,0.15)" strokeWidth="2" />
                    <path d="M24 2 A22 22 0 0 1 46 24" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-bold text-base">
                  {allFinished ? "Lot traité" : "Analyse du lot"}
                </p>
                <p className="text-slate-400 text-xs">
                  {allFinished
                    ? `${done} traitée${done > 1 ? "s" : ""}${errored > 0 ? ` · ${errored} erreur${errored > 1 ? "s" : ""}` : ""}`
                    : current
                      ? `${done}/${total} · ${stepMessage(current) || current.fileName}`
                      : `${done}/${total}`}
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto mb-5 pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      item.status === "done"
                        ? "border-blue-400 bg-blue-50"
                        : item.status === "error"
                          ? "border-red-400 bg-red-50"
                          : item.status === "uploading" || item.status === "processing"
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200"
                    }`}
                  >
                    {item.status === "done" && <CheckCircle2 size={12} className="text-blue-500" />}
                    {item.status === "error" && <AlertTriangle size={11} className="text-red-500" />}
                    {(item.status === "uploading" || item.status === "processing") && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${item.status === "error" ? "text-red-500" : "text-slate-700"}`}>
                      {item.fileName}
                    </p>
                    {item.status === "done" && (item.supplier || item.itemsCount) && (
                      <p className="text-[10px] text-slate-400 truncate">
                        {item.supplier ?? "Fournisseur inconnu"}{item.itemsCount ? ` · ${item.itemsCount} produits` : ""}
                      </p>
                    )}
                    {(item.status === "uploading" || item.status === "processing") && (
                      <p className="text-[10px] text-blue-500 truncate">{stepMessage(item)}</p>
                    )}
                    {item.status === "error" && item.error && (
                      <p className="text-[10px] text-red-400 truncate">{item.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {allFinished && (
              <div className="space-y-2">
                <button onClick={onClose} className="btn-primary w-full py-3 rounded-xl text-sm">
                  Voir les résultats
                </button>
                {errored > 0 && (
                  <button
                    onClick={onRetake}
                    className="w-full py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Camera size={14} /> Reprendre les scans en erreur
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
