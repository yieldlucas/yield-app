"use client";

import Link from "next/link";
import { ChefHat, Download, Settings, User } from "lucide-react";
import { NotificationsBell } from "./NotificationsBell";
import { type Alert } from "./types";

/**
 * Header du dashboard : logo + actions (export CSV, billing portal, badge
 * quota, cloche notifs, profil). Sticky en haut. État 100% contrôlé par les
 * props — aucune logique de fetch ici.
 *
 * La cloche est désormais cliquable et ouvre un drawer/popover listant les
 * alertes. Voir NotificationsBell.
 */
export function DashboardHeader({
  invoicesCount,
  exportLoading,
  onExportCsv,
  isSubscribed,
  portalLoading,
  onOpenPortal,
  usage,
  onQuotaClick,
  alerts,
  onAlertClick,
}: {
  invoicesCount: number;
  exportLoading: boolean;
  onExportCsv: () => void;
  isSubscribed: boolean;
  portalLoading: boolean;
  onOpenPortal: () => void;
  usage: { used: number; quota: number } | null;
  onQuotaClick: () => void;
  alerts: Alert[];
  onAlertClick: (invoiceId: string, alertId: string) => void;
}) {
  return (
    <div className="glass-nav sticky top-0 z-20">
      <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl btn-primary flex items-center justify-center">
            <ChefHat size={16} className="text-white" />
          </div>
          <span className="font-black text-base tracking-tight gradient-text">YIELD</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onExportCsv}
            disabled={exportLoading || invoicesCount === 0}
            className="text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Export comptable CSV"
            title="Export comptable CSV"
          >
            {exportLoading ? (
              <div className="w-[18px] h-[18px] border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            ) : (
              <Download size={18} />
            )}
          </button>
          {isSubscribed && (
            <button
              onClick={onOpenPortal}
              disabled={portalLoading}
              className="text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-40"
              aria-label="Gérer l'abonnement"
              title="Gérer l'abonnement"
            >
              {portalLoading ? (
                <div className="w-[18px] h-[18px] border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              ) : (
                <Settings size={18} />
              )}
            </button>
          )}
          {usage && <UsageBadge usage={usage} onClick={onQuotaClick} />}
          <NotificationsBell alerts={alerts} onAlertClick={onAlertClick} />
          <Link
            href="/dashboard/profile"
            className="text-slate-400 hover:text-blue-600 transition-colors"
            aria-label="Mon profil"
            title="Mon profil"
          >
            <User size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Badge "X/200" coloré selon le seuil. Cliquable seulement si quota atteint. */
function UsageBadge({
  usage,
  onClick,
}: {
  usage: { used: number; quota: number };
  onClick: () => void;
}) {
  const pct = (usage.used / usage.quota) * 100;
  const reached = pct >= 100;
  const tone = reached
    ? "text-rose-600 bg-rose-50 border-rose-200"
    : pct >= 80
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-500 bg-slate-50 border-slate-200";
  const className = `px-2 py-1 rounded-lg border text-[11px] font-semibold tabular-nums ${tone}`;
  const label = `${usage.used}/${usage.quota}`;
  const tooltip = `Consommation : ${usage.used} / ${usage.quota} scans ce mois`;
  return reached ? (
    <button onClick={onClick} className={className} title={tooltip} aria-label="Quota mensuel atteint">
      {label}
    </button>
  ) : (
    <span className={className} title={tooltip} aria-label="Quota mensuel">
      {label}
    </span>
  );
}
