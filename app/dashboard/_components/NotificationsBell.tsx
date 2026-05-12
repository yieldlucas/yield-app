"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, ChevronRight, Snowflake, TrendingDown, X,
} from "lucide-react";
import { type Alert } from "./types";
import { toggleProductSeasonal } from "../_lib/dashboard-data";

/**
 * Cloche de notifications : badge rouge si alertes non-lues, drawer responsive
 * au clic.
 *
 * Layout :
 *   - mobile : drawer bottom (slide up depuis le bas, fixed bottom-0)
 *   - desktop : popover dropdown sous la cloche (sm:absolute sm:top-12)
 *
 * Onglets :
 *   - "Actives" : alertes vraies (produits non saisonniers)
 *   - "Saisonniers" : alertes ignorées via toggle (tomates en hiver, etc.)
 *
 * Le toggle "Marquer saisonnier" déplace toutes les futures alertes du
 * produit vers l'onglet Saisonniers, et masque celles déjà présentes.
 */
export function NotificationsBell({
  alerts,
  onAlertClick,
}: {
  alerts: Alert[];
  onAlertClick: (invoiceId: string, alertId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"active" | "seasonal">("active");

  // Optimistic state pour le toggle saisonnier : on patche localement
  // pour un retour instantané, le fetch refresh confirmera ensuite.
  const [optimisticSeasonal, setOptimisticSeasonal] = useState<Record<string, boolean>>({});

  const enriched = useMemo(
    () => alerts.map((a) => ({
      ...a,
      product_is_seasonal: a.product_id != null && optimisticSeasonal[a.product_id] !== undefined
        ? optimisticSeasonal[a.product_id]
        : a.product_is_seasonal,
    })),
    [alerts, optimisticSeasonal],
  );

  const activeAlerts = enriched.filter((a) => !a.product_is_seasonal);
  const seasonalAlerts = enriched.filter((a) => a.product_is_seasonal);
  const visibleAlerts = tab === "active" ? activeAlerts : seasonalAlerts;

  const hasAlerts = activeAlerts.length > 0;
  const badgeCount = activeAlerts.length;

  const handleClick = (a: Alert) => {
    if (!a.invoice_id) return;
    setOpen(false);
    onAlertClick(a.invoice_id, a.id);
  };

  const handleToggleSeasonal = async (a: Alert) => {
    if (!a.product_id) return;
    const next = !a.product_is_seasonal;
    setOptimisticSeasonal((prev) => ({ ...prev, [a.product_id!]: next }));
    const ok = await toggleProductSeasonal(a.product_id, next);
    if (!ok) {
      // Rollback en cas d'erreur RLS / réseau
      setOptimisticSeasonal((prev) => {
        const copy = { ...prev };
        delete copy[a.product_id!];
        return copy;
      });
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative text-slate-400 hover:text-blue-600 transition-colors"
        aria-label={hasAlerts ? `${badgeCount} alerte${badgeCount > 1 ? "s" : ""} de prix` : "Aucune alerte"}
        title={hasAlerts ? `${badgeCount} alerte${badgeCount > 1 ? "s" : ""} de prix` : "Aucune alerte"}
      >
        <Bell size={20} className={hasAlerts ? "text-slate-700" : "text-slate-400"} />
        {hasAlerts && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
            aria-hidden
          >
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:bottom-auto sm:left-auto sm:top-16 sm:right-5 sm:w-96 sm:max-h-[70vh] sm:rounded-2xl sm:border sm:border-slate-100"
              role="dialog"
              aria-label="Alertes de prix"
            >
              <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 rounded-t-3xl sm:rounded-t-2xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-900 font-bold text-sm">Alertes prix</p>
                  <button
                    onClick={() => setOpen(false)}
                    className="text-slate-400 hover:text-slate-700 transition-colors"
                    aria-label="Fermer"
                  >
                    <X size={18} />
                  </button>
                </div>
                {/* Onglets : Actives / Saisonniers (apparaît seulement si saisonniers existent) */}
                {seasonalAlerts.length > 0 && (
                  <div className="flex gap-1.5">
                    <TabPill
                      label="Actives"
                      count={activeAlerts.length}
                      active={tab === "active"}
                      onClick={() => setTab("active")}
                    />
                    <TabPill
                      label="Saisonniers"
                      count={seasonalAlerts.length}
                      active={tab === "seasonal"}
                      onClick={() => setTab("seasonal")}
                      icon={<Snowflake size={11} />}
                    />
                  </div>
                )}
              </div>

              {visibleAlerts.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {visibleAlerts.map((a) => {
                    const isHigh = Math.abs(a.price_change_pct) >= 10;
                    const sign = a.price_change_pct >= 0 ? "+" : "";
                    const disabled = !a.invoice_id;
                    const isSeasonal = a.product_is_seasonal;
                    return (
                      <li key={a.id} className="group/row">
                        <div className="flex items-stretch">
                          <button
                            onClick={() => handleClick(a)}
                            disabled={disabled}
                            className="flex-1 px-5 py-3 flex items-start gap-3 text-left hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={disabled ? "Facture introuvable" : `Voir la facture · ${a.supplier_name ?? "Fournisseur inconnu"}`}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSeasonal ? "bg-slate-50"
                                : isHigh ? "bg-red-50" : "bg-blue-50"
                            }`}>
                              {isSeasonal ? (
                                <Snowflake size={15} className="text-slate-400" />
                              ) : (
                                <TrendingDown size={15} className={isHigh ? "text-red-500" : "text-blue-600"} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`font-semibold text-sm truncate ${isSeasonal ? "text-slate-500" : "text-slate-800"}`}>
                                  {a.product_name}
                                </p>
                                <span
                                  className={`text-xs font-bold font-mono flex-shrink-0 px-1.5 py-0.5 rounded ${
                                    isSeasonal ? "bg-slate-100 text-slate-500"
                                      : isHigh ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-600"
                                  }`}
                                >
                                  {sign}{a.price_change_pct.toFixed(1)}%
                                </span>
                              </div>
                              <p className="text-slate-400 text-xs mt-0.5 truncate">
                                {a.supplier_name ?? "Fournisseur inconnu"}
                                {disabled && (
                                  <span className="ml-1 italic text-slate-300">· facture supprimée</span>
                                )}
                              </p>
                            </div>
                            {!disabled && !isSeasonal && (
                              <ChevronRight size={14} className="text-slate-300 flex-shrink-0 self-center" />
                            )}
                          </button>
                          {/* Toggle saisonnier : visible au hover desktop, toujours visible mobile (no hover) */}
                          {a.product_id && (
                            <button
                              onClick={() => void handleToggleSeasonal(a)}
                              className={`flex-shrink-0 px-3 flex items-center transition-colors ${
                                isSeasonal
                                  ? "text-blue-600 hover:bg-blue-50"
                                  : "text-slate-300 hover:text-slate-700 hover:bg-slate-50 sm:opacity-0 sm:group-hover/row:opacity-100"
                              }`}
                              title={isSeasonal
                                ? "Re-suivre les alertes sur ce produit"
                                : "Marquer comme saisonnier (ignorer les variations attendues)"}
                              aria-label={isSeasonal ? "Retirer le tag saisonnier" : "Marquer saisonnier"}
                            >
                              <Snowflake size={14} />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm text-center py-10 px-5">
                  {tab === "active"
                    ? "Aucune alerte de prix récente."
                    : "Aucun produit marqué saisonnier."}
                </p>
              )}

              {/* Footer pédagogique sous l'onglet Actives — explique le tag */}
              {tab === "active" && visibleAlerts.length > 0 && (
                <p className="text-[11px] text-slate-400 px-5 py-3 border-t border-slate-100 leading-relaxed">
                  Variation attendue (tomate en hiver, etc.) ?{" "}
                  <Snowflake size={10} className="inline -mt-0.5" /> au survol de la ligne pour ignorer.
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function TabPill({
  label, count, active, onClick, icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {icon}
      {label}
      <span className={`text-[10px] tabular-nums ${active ? "text-white/70" : "text-slate-400"}`}>
        {count}
      </span>
    </button>
  );
}
