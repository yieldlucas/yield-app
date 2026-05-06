"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, Camera, ChefHat, Sparkles } from "lucide-react";

/**
 * Modal d'accueil affiché à la 1ère visite (flag localStorage
 * `yield_onboarding_seen`). Présente le pitch en 3 étapes et un CTA
 * "Scanner mon premier BL".
 */
export function OnboardingModal({
  show,
  onClose,
  onStart,
}: {
  show: boolean;
  onClose: () => void;
  onStart: () => void;
}) {
  const steps = [
    { n: "01", Icon: Camera, title: "Photographiez", desc: "Le bon de livraison, à réception, en 5 secondes." },
    { n: "02", Icon: Sparkles, title: "L'IA lit", desc: "Chaque ligne matière est extraite et comparée à vos historiques." },
    { n: "03", Icon: Bell, title: "Alerte rendement", desc: "Dès qu'une hausse dépasse 3%, YIELD vous prévient." },
  ];
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-center p-5"
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 16 }}
            className="card rounded-3xl p-8 max-w-sm w-full shadow-card"
          >
            <div className="w-14 h-14 btn-primary rounded-2xl flex items-center justify-center mx-auto mb-5 glow-blue-sm">
              <ChefHat size={26} className="text-white" />
            </div>
            <h2 className="text-slate-900 font-bold text-xl text-center mb-2">Bienvenue, chef</h2>
            <p className="text-slate-500 text-sm text-center mb-7 leading-relaxed">
              Scannez votre premier bon de livraison en 2 minutes. YIELD veille sur votre rendement.
            </p>
            <div className="space-y-4 mb-7">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-9 h-9 label-blue rounded-xl flex items-center justify-center flex-shrink-0">
                    <s.Icon size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-slate-300 font-mono text-xs font-bold">{s.n}</span>
                      <p className="text-slate-900 font-semibold text-sm">{s.title}</p>
                    </div>
                    <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onStart} className="btn-primary w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <Camera size={15} /> Scanner mon premier BL
            </button>
            <button onClick={onClose} className="w-full mt-2 py-2.5 text-sm text-slate-400 hover:text-slate-700 transition-colors">
              Plus tard
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
