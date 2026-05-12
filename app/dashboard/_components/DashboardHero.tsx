"use client";

// DashboardHero — point d'entrée principal du dashboard.
// Deux cards côte à côte qui clarifient les deux faces de Yield :
//
//   Card A (Le Moteur)   : Scanner — alimente la base de prix
//   Card B (Le Pilote)   : Recettes — pilote les marges
//
// L'objectif est que le chef comprenne en 2 secondes que ces deux modules
// fonctionnent ensemble : sans scan, pas de prix à jour ; sans recette, pas
// d'alerte de dérive sur ses plats.

import { motion } from "framer-motion";
import Link from "next/link";
import { Camera, ChefHat, ChevronRight, Salad, ScanLine } from "lucide-react";

export function DashboardHero({
  onScan,
  onCreateRecipe,
  recipesCount = 0,
}: {
  onScan: () => void;
  onCreateRecipe: () => void;
  /** Nombre de recettes enregistrées — adapte le label de la Card B
   *  ("Créer une recette" si 0, "Voir mes recettes (N)" sinon). */
  recipesCount?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      {/* ── Card A — Le Moteur ────────────────────────────── */}
      <button
        onClick={onScan}
        className="group relative overflow-hidden text-left rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-500 to-blue-600 p-5 shadow-sm hover:shadow-lg transition-all"
      >
        {/* Halo décoratif */}
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Camera size={18} className="text-white" />
            </div>
            <span className="text-white/70 text-[10px] font-bold uppercase tracking-wider">
              Le Moteur
            </span>
          </div>
          <h3 className="text-white font-bold text-base leading-tight mb-1">
            Alimentez vos données
          </h3>
          <p className="text-white/80 text-[12px] leading-snug mb-4">
            Chaque scan met à jour vos prix en temps réel.
          </p>
          <span className="inline-flex items-center gap-1.5 text-white text-[13px] font-semibold bg-white/15 hover:bg-white/25 backdrop-blur-sm px-3.5 py-2 rounded-xl transition-colors">
            <ScanLine size={14} />
            Scanner une facture
            <ChevronRight size={14} className="-mr-1 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </button>

      {/* ── Card B — Le Pilote ────────────────────────────── */}
      <Link
        href="/dashboard/recipes"
        onClick={(e) => {
          // Si pas encore de recettes, on ouvre directement la calculatrice
          // pour amorcer la 1ère composition (CTA "Créer une recette" plus
          // direct que d'aller sur la liste vide).
          if (recipesCount === 0) {
            e.preventDefault();
            onCreateRecipe();
          }
        }}
        className="group relative overflow-hidden text-left rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm hover:shadow-lg hover:border-emerald-200 transition-all"
      >
        <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-emerald-50 blur-2xl opacity-70" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ChefHat size={18} className="text-emerald-700" />
            </div>
            <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
              Le Pilote
            </span>
          </div>
          <h3 className="text-slate-900 font-bold text-base leading-tight mb-1">
            Surveillez vos marges
          </h3>
          <p className="text-slate-500 text-[12px] leading-snug mb-4">
            Liez vos plats à vos factures pour ne plus jamais subir de hausses cachées.
          </p>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 text-[13px] font-semibold bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl transition-colors">
            <Salad size={14} />
            {recipesCount === 0 ? "Créer une recette" : `Voir mes recettes (${recipesCount})`}
            <ChevronRight size={14} className="-mr-1 transition-transform group-hover:translate-x-0.5" />
          </span>
          {/* Le sous-texte "X plats à surveiller" a été retiré pour éviter
              la redondance avec CardHealthWidget qui détaille la santé juste
              en dessous. Hero = action, Widget = status. */}
        </div>
      </Link>
    </motion.div>
  );
}
