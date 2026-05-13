"use client";

// Easter egg ciblé : modal de bienvenue personnalisée pour UN seul user.
// One-shot (localStorage). Pour retirer la blague : supprime ce fichier +
// l'import + le rendering dans app/dashboard/page.tsx (3 lignes total).
//
// ── COMMENT C'EST DÉCLENCHÉ ─────────────────────────────────────────────
//   1. Au mount du dashboard, on récupère l'email de la session
//   2. Si l'email (normalisé lowercase + trim) match TARGET_EMAIL
//   3. ET si l'user n'a pas déjà fermé la modal (localStorage flag)
//   4. → on affiche
//
// ── COMMENT C'EST SAFE ──────────────────────────────────────────────────
//   - Aucune écriture en DB (juste un localStorage local au device de Clément)
//   - Aucune fuite de données (l'email est en clair dans le bundle mais c'est
//     juste un identifiant, pas une donnée sensible)
//   - Si l'user ne match pas → composant render null, zéro impact perf
//   - Le check email se fait ENTIÈREMENT côté client : il y a une RPC ou
//     route serveur impliquée

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

// ─── À CUSTOMIZER ─────────────────────────────────────────────────────────
// Édite ces constantes pour changer la cible ou le message. Pour désactiver
// complètement : commente l'import + le <EasterEggModal /> dans dashboard/page.tsx.

const TARGET_EMAIL = "clement.teani@orange.fr";

const MODAL_TITLE = "🎉 Tiens tiens, Clément !";
const MODAL_BODY = [
  "Bienvenue dans la base de données Yield, monsieur Teani.",
  "Tu es officiellement le chef #002 — Lucas garde le #001, désolé.",
  "T'as 14 jours d'essai. Je veux voir tes marges dans le vert avant la fin du mois 👨‍🍳",
];
const DISMISS_LABEL = "OK chef";

// localStorage key qui mémorise que la modal a déjà été vue.
// Si tu veux la réafficher (pour tester sur ton compte par exemple), tape
// dans la console : localStorage.removeItem("yield_easter_egg_clement_seen")
const SEEN_KEY = "yield_easter_egg_clement_seen";

// ─── Composant ────────────────────────────────────────────────────────────

export function EasterEggModal({ userEmail }: { userEmail: string | null }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    // Normalisation : lowercase + trim. Couvre "Clement.Teani@Orange.fr" et co.
    const normalized = userEmail.trim().toLowerCase();
    if (normalized !== TARGET_EMAIL) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SEEN_KEY) === "1") return;
    // Petit délai pour que la modal n'apparaisse pas pile au moment du paint
    // initial (l'effet "surprise" est plus net quand le dashboard a fini de
    // charger 600ms après).
    const t = window.setTimeout(() => setShow(true), 600);
    return () => window.clearTimeout(t);
  }, [userEmail]);

  const dismiss = () => {
    setShow(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(SEEN_KEY, "1");
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-slate-900/55 backdrop-blur-sm"
            onClick={dismiss}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="fixed inset-0 z-[81] flex items-center justify-center p-5 pointer-events-none"
          >
            <div
              className="rounded-3xl shadow-2xl overflow-hidden text-white relative w-full max-w-md pointer-events-auto"
              style={{ background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 60%, #7C3AED 100%)" }}
            >
              {/* Halos décoratifs */}
              <div aria-hidden className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/15 blur-3xl pointer-events-none" />
              <div aria-hidden className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />

              <div className="relative px-7 py-8">
                <h2 className="text-2xl font-bold text-center leading-tight mb-4">
                  {MODAL_TITLE}
                </h2>
                {MODAL_BODY.map((line, i) => (
                  <p key={i} className="text-white/95 text-sm leading-relaxed text-center mb-3 last:mb-0">
                    {line}
                  </p>
                ))}
                <button
                  onClick={dismiss}
                  className="w-full mt-6 py-3 rounded-xl bg-white text-blue-700 font-bold text-sm hover:bg-blue-50 transition-colors"
                >
                  {DISMISS_LABEL}
                </button>
                <p className="text-white/60 text-[10px] text-center mt-3">
                  PS : ce message a été codé par Lucas spécialement pour toi. Suis pas dupe.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
