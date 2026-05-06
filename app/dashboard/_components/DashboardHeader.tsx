"use client";

import Link from "next/link";
import { Bell, ChefHat, Download, Settings, User } from "lucide-react";

/**
 * Header du dashboard : logo + actions (export CSV, billing portal, badge
 * quota, cloche notifs, profil). Sticky en haut. État 100% contrôlé par les
 * props — aucune logique de fetch ici.
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
  bellBadge,
  processedToday,
}: {
  invoicesCount: number;
  exportLoading: boolean;
  onExportCsv: () => void;
  isSubscribed: boolean;
  portalLoading: boolean;
  onOpenPortal: () => void;
  usage: { used: number; quota: number } | null;
  onQuotaClick: () => void;
  bellBadge: number;
  processedToday: number;
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
          <div
            className="relative"
            title={processedToday > 0 ? `${processedToday} BL traités aujourd'hui` : "Aucune notif"}
          >
            <Bell size={20} className={bellBadge > 0 ? "text-slate-700" : "text-slate-400"} />
            {bellBadge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-blue-600 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {bellBadge}
              </span>
            )}
          </div>
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
