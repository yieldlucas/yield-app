"use client";

import { motion } from "framer-motion";
import { type MonthlyStats } from "../_lib/dashboard-data";
import { VARIATION_ALERT_PCT } from "./types";

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatEuros(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

function previousMonthLabel(): string {
  const d = new Date();
  d.setDate(0); // jour 0 du mois courant = dernier jour du mois précédent
  return MONTHS_FR[d.getMonth()];
}

/**
 * Strip de 3 KPIs synthétiques en haut du dashboard. Donne le pouls du mois
 * en un coup d'œil, sans nécessiter de scanner la timeline.
 *
 * Caché tant qu'aucune facture du mois n'est traitée — un strip vide à 0€
 * donnerait une impression de stagnation injustifiée le 1er du mois.
 */
export function MonthlyStatsStrip({
  stats,
  alertsCount,
}: {
  stats: MonthlyStats | null;
  alertsCount: number;
}) {
  if (!stats || stats.invoicesCount === 0) return null;

  const variation = stats.weightedVariationPct;
  // Code couleur aligné avec InvoiceCard / VariationBadge :
  //   ≥ +7%  rouge  (alerte)
  //   < 0    vert   (gain)
  //   sinon  neutre
  const variationTone =
    variation == null
      ? "text-slate-400"
      : variation >= VARIATION_ALERT_PCT
        ? "text-rose-600"
        : variation < 0
          ? "text-emerald-600"
          : "text-slate-700";

  const alertsTone = alertsCount > 0 ? "text-rose-600" : "text-slate-700";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
    >
      <Kpi label="Total HT" value={formatEuros(stats.totalHt)} sub="ce mois" />
      <Kpi
        label="Variation"
        value={variation == null
          ? "—"
          : `${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%`}
        sub={`vs ${previousMonthLabel()}`}
        tone={variationTone}
      />
      <Kpi
        label="Alertes"
        value={`${alertsCount}`}
        sub={alertsCount === 1 ? "produit" : "produits"}
        tone={alertsTone}
      />
    </motion.div>
  );
}

/** Bloc colonne d'un KPI. Centré en mobile, aligné gauche en desktop. */
function Kpi({
  label,
  value,
  sub,
  tone = "text-slate-900",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="text-center sm:text-left min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`text-lg font-bold tabular-nums leading-tight mt-1 truncate ${tone}`}
      >
        {value}
      </p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
