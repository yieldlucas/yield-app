"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronRight, TrendingDown, X } from "lucide-react";
import { type Alert } from "./types";

/**
 * Cloche de notifications : badge rouge si alertes non-lues, drawer responsive
 * au clic.
 *
 * Layout :
 *   - mobile : drawer bottom (slide up depuis le bas, fixed bottom-0)
 *   - desktop : popover dropdown sous la cloche (sm:absolute sm:top-12)
 *   Une seule implémentation, classes Tailwind responsive.
 *
 * Comportement : clic sur une alerte → onAlertClick(invoiceId, alertId)
 *   → le caller redirige vers /dashboard/invoices/[id] et marque l'alerte lue.
 *   Si invoice_id est null (facture supprimée), la ligne est désactivée.
 */
export function NotificationsBell({
  alerts,
  onAlertClick,
}: {
  alerts: Alert[];
  onAlertClick: (invoiceId: string, alertId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasAlerts = alerts.length > 0;
  const count = alerts.length;

  const handleClick = (a: Alert) => {
    if (!a.invoice_id) return;
    setOpen(false);
    onAlertClick(a.invoice_id, a.id);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative text-slate-400 hover:text-blue-600 transition-colors"
        aria-label={hasAlerts ? `${count} alerte${count > 1 ? "s" : ""} de prix` : "Aucune alerte"}
        title={hasAlerts ? `${count} alerte${count > 1 ? "s" : ""} de prix` : "Aucune alerte"}
      >
        <Bell size={20} className={hasAlerts ? "text-slate-700" : "text-slate-400"} />
        {hasAlerts && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
            aria-hidden
          >
            {count > 9 ? "9+" : count}
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
              <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <p className="text-slate-900 font-bold text-sm">Alertes Rendement</p>
                  {hasAlerts && (
                    <span className="text-xs label-blue px-2 py-0.5 rounded-full font-semibold">
                      {count}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-700 transition-colors"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>

              {hasAlerts ? (
                <ul className="divide-y divide-slate-100">
                  {alerts.map((a) => {
                    const isHigh = Math.abs(a.price_change_pct) >= 10;
                    const sign = a.price_change_pct >= 0 ? "+" : "";
                    const disabled = !a.invoice_id;
                    return (
                      <li key={a.id}>
                        <button
                          onClick={() => handleClick(a)}
                          disabled={disabled}
                          className="w-full px-5 py-3 flex items-start gap-3 text-left hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={disabled ? "Facture introuvable" : `Voir la facture · ${a.supplier_name ?? "Fournisseur inconnu"}`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isHigh ? "bg-red-50" : "bg-blue-50"}`}>
                            <TrendingDown size={15} className={isHigh ? "text-red-500" : "text-blue-600"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-slate-800 font-semibold text-sm truncate">
                                {a.product_name}
                              </p>
                              <span
                                className={`text-xs font-bold font-mono flex-shrink-0 px-1.5 py-0.5 rounded ${isHigh ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-600"}`}
                              >
                                {sign}{a.price_change_pct.toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-slate-400 text-xs mt-0.5 truncate">
                              {a.supplier_name ?? "Fournisseur inconnu"}
                            </p>
                          </div>
                          {!disabled && (
                            <ChevronRight size={14} className="text-slate-300 flex-shrink-0 self-center" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm text-center py-10 px-5">
                  Aucune alerte de prix récente.
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
