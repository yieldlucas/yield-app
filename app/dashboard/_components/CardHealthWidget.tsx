"use client";

// Mini-widget "Santé de votre Carte" — affiché sur le dashboard, agit comme
// porte d'entrée vers /dashboard/recipes. Lit recipes_with_health côté client
// (RLS scope auto). Conformément au brief "zéro bruit" : pas de notification,
// l'info reste latente sur le dashboard et l'user décide quand creuser.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronRight, Salad, ShieldCheck } from "lucide-react";
import { fetchRecipesHealth } from "../_lib/recipes-data";

export function CardHealthWidget() {
  const [stats, setStats] = useState<{ total: number; critical: number; warning: number } | null>(null);

  useEffect(() => {
    void (async () => {
      setStats(await fetchRecipesHealth());
    })();
  }, []);

  // Avant chargement OU si l'user n'a aucune recette : on cache. Pas de bruit
  // visuel inutile — le DashboardHero juste au-dessus invite déjà à créer.
  if (!stats || stats.total === 0) return null;

  const attention = stats.critical + stats.warning;
  const tone = stats.critical > 0
    ? { border: "border-rose-200", bg: "bg-rose-50/60", text: "text-rose-700", Icon: AlertTriangle }
    : attention > 0
      ? { border: "border-amber-200", bg: "bg-amber-50/60", text: "text-amber-700", Icon: AlertTriangle }
      : { border: "border-emerald-200", bg: "bg-emerald-50/60", text: "text-emerald-700", Icon: ShieldCheck };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    >
      <Link
        href="/dashboard/recipes"
        className={`block rounded-2xl border p-4 hover:shadow-md transition-all ${tone.border} ${tone.bg}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 ${tone.text}`}>
            <Salad size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Santé de votre carte
            </p>
            <p className={`text-sm font-semibold leading-tight ${tone.text}`}>
              {attention === 0
                ? `${stats.total} plat${stats.total > 1 ? "s" : ""} sain${stats.total > 1 ? "s" : ""}`
                : `${attention} plat${attention > 1 ? "s" : ""} nécessite${attention > 1 ? "nt" : ""} votre attention`}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {stats.critical > 0 && <strong className="text-rose-700">{stats.critical} critique{stats.critical > 1 ? "s" : ""}</strong>}
              {stats.critical > 0 && stats.warning > 0 && " · "}
              {stats.warning > 0 && <strong className="text-amber-700">{stats.warning} à surveiller</strong>}
              {attention === 0 && "Marges au-dessus de 75% — food cost maîtrisé."}
            </p>
          </div>
          <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}
