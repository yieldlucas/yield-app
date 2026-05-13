"use client";

// Lettre personnelle de Lucas affichée à la première connexion d'un chef.
// Un seul affichage à vie via profiles.founder_letter_seen_at — c'est un
// moment fondateur, pas un toast récurrent.
//
// Si la migration 016 n'est pas appliquée OU le webhook n'a pas tourné,
// founderNumber est null → on cache le numéro mais on affiche la lettre.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Mail } from "lucide-react";

export function FounderLetter({
  show,
  founderNumber,
  onClose,
}: {
  show: boolean;
  founderNumber: number | null;
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);

  if (!show) return null;

  const close = () => {
    setClosing(true);
    // Anim 250ms avant unmount
    setTimeout(onClose, 250);
  };

  return (
    <AnimatePresence>
      {!closing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-slate-900/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative"
            role="dialog"
            aria-label="Mot de bienvenue de Lucas"
          >
            {/* Header avec gradient — première impression chaleureuse */}
            <div
              className="px-7 py-6 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 60%, #7C3AED 100%)" }}
            >
              <div aria-hidden className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <ChefHat size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Yield · Bienvenue
                  </p>
                  <p className="font-bold text-lg leading-tight">
                    {founderNumber != null
                      ? `Membre fondateur #${String(founderNumber).padStart(3, "0")}`
                      : "Membre fondateur"}
                  </p>
                </div>
              </div>
            </div>

            {/* Lettre */}
            <div className="px-7 py-6 space-y-4 text-slate-700 text-[14px] leading-relaxed">
              <p>Salut Chef,</p>
              <p>
                Je suis Lucas, le fondateur de Yield. Je viens du Gers, j&apos;ai vu mes
                anciens patrons galérer 18h par jour pour comprendre où partait leur
                marge à la fin du mois.
              </p>
              <p>
                Yield est pensé pour ça, et seulement ça : <strong className="text-slate-900">tu
                scannes tes BL, l&apos;app surveille tes prix en temps réel,
                tu négocies avant de servir à perte.</strong>
              </p>
              <p>
                {founderNumber != null && founderNumber <= 50 ? (
                  <>
                    Tu es l&apos;un des premiers à rejoindre. Ton retour va façonner
                    le produit pour les milliers de chefs qui suivront. Je lis chaque mail
                    personnellement.
                  </>
                ) : (
                  <>
                    Je lis chaque mail personnellement. Si quelque chose te bloque,
                    ou si tu as une idée pour améliorer Yield, écris-moi.
                  </>
                )}
              </p>
              <p>
                À très vite en cuisine,<br />
                <strong className="text-slate-900">— Lucas</strong>
              </p>

              {/* Email direct */}
              <a
                href="mailto:lucasyieldapp@gmail.com"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-[13px] font-semibold"
              >
                <Mail size={14} /> lucasyieldapp@gmail.com
              </a>
            </div>

            {/* CTA — close + mark seen */}
            <div className="px-7 pb-7">
              <button
                onClick={close}
                className="btn-primary w-full py-3 rounded-xl text-sm font-semibold"
              >
                Allons-y, Chef
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
