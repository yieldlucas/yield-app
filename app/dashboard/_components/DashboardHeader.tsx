"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Calculator, ChefHat, Download, HelpCircle, MoreHorizontal, Salad, Settings,
  User,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { NotificationsBell } from "./NotificationsBell";
import { type Alert } from "./types";

/**
 * Header du dashboard : logo + actions. Sticky en haut. État 100% contrôlé
 * par les props — aucune logique de fetch ici.
 *
 * Sur mobile, les actions secondaires (Export CSV, billing portal, aide)
 * sont regroupées dans un menu "..." pour libérer de l'espace. Les actions
 * primaires restent inline : calculateur, recettes, cloche, profil.
 *
 * Le bouton calculatrice ne porte plus son propre état : on délègue
 * l'ouverture au parent (dashboard/page.tsx) pour que le DashboardHero du
 * body puisse partager le même drawer.
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
  onOpenCalculator,
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
  onOpenCalculator: () => void;
}) {
  return (
    <div className="glass-nav sticky top-0 z-20">
      <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl btn-primary flex items-center justify-center">
            <ChefHat size={16} className="text-white" />
          </div>
          <span className="font-black text-base tracking-tight gradient-text">YIELD</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Actions secondaires : inline sur desktop, dans le menu "..." sur mobile.
              Ordre desktop : Export · Portail (si abonné) · Help */}
          <button
            onClick={onExportCsv}
            disabled={exportLoading || invoicesCount === 0}
            className="hidden sm:inline-flex text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              className="hidden sm:inline-flex text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-40"
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
          <Link
            href="/how-it-works"
            className="hidden sm:inline-flex text-slate-400 hover:text-blue-600 transition-colors"
            aria-label="Comment ça marche"
            title="Comment ça marche"
          >
            <HelpCircle size={18} />
          </Link>

          {/* Actions primaires — toujours visibles, même sur mobile */}
          {usage && <UsageBadge usage={usage} onClick={onQuotaClick} />}
          <button
            onClick={onOpenCalculator}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[12px] font-semibold transition-colors"
            aria-label="Calculatrice de marge"
            title="Calculateur Marge"
          >
            <Calculator size={14} />
            <span className="hidden sm:inline whitespace-nowrap">Calculateur</span>
          </button>
          <Link
            href="/dashboard/recipes"
            className="text-slate-400 hover:text-blue-600 transition-colors"
            aria-label="Mes recettes"
            title="Mes recettes"
          >
            <Salad size={18} />
          </Link>
          <NotificationsBell alerts={alerts} onAlertClick={onAlertClick} />
          <Link
            href="/dashboard/profile"
            className="hidden sm:inline-flex text-slate-400 hover:text-blue-600 transition-colors"
            aria-label="Mon profil"
            title="Mon profil"
          >
            <User size={18} />
          </Link>

          {/* Menu "..." mobile uniquement — regroupe Export / Portail / Help / Profil */}
          <MobileMoreMenu
            onExportCsv={onExportCsv}
            exportLoading={exportLoading}
            exportDisabled={invoicesCount === 0}
            isSubscribed={isSubscribed}
            onOpenPortal={onOpenPortal}
            portalLoading={portalLoading}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Menu "..." mobile ──────────────────────────────────────────────────────
// Caché sur desktop (sm:hidden). Sur mobile, regroupe les actions secondaires
// pour libérer de l'espace dans la barre d'action principale.
function MobileMoreMenu({
  onExportCsv, exportLoading, exportDisabled,
  isSubscribed, onOpenPortal, portalLoading,
}: {
  onExportCsv: () => void;
  exportLoading: boolean;
  exportDisabled: boolean;
  isSubscribed: boolean;
  onOpenPortal: () => void;
  portalLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic en dehors (le user touche ailleurs sur l'écran).
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative sm:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-slate-400 hover:text-blue-600 transition-colors p-0.5"
        aria-label="Plus d'actions"
        aria-expanded={open}
      >
        <MoreHorizontal size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-8 z-50 min-w-[200px] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden"
            role="menu"
          >
            <MenuItem
              icon={<Download size={15} />}
              label={exportLoading ? "Export en cours…" : "Export CSV"}
              onClick={() => { setOpen(false); onExportCsv(); }}
              disabled={exportLoading || exportDisabled}
            />
            {isSubscribed && (
              <MenuItem
                icon={<Settings size={15} />}
                label={portalLoading ? "Ouverture…" : "Gérer mon abonnement"}
                onClick={() => { setOpen(false); onOpenPortal(); }}
                disabled={portalLoading}
              />
            )}
            <div className="h-px bg-slate-100" />
            <MenuItem
              icon={<User size={15} />}
              label="Mon profil"
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
            />
            <MenuItem
              icon={<HelpCircle size={15} />}
              label="Comment ça marche"
              href="/how-it-works"
              onClick={() => setOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon, label, onClick, href, disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const baseClass = "w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed";
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={baseClass} role="menuitem">
        <span className="text-slate-400">{icon}</span>
        {label}
      </Link>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={baseClass} role="menuitem">
      <span className="text-slate-400">{icon}</span>
      {label}
    </button>
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
