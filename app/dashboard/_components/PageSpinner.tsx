"use client";

// Loader plein écran utilisé pendant le 1er chargement de n'importe quelle
// page du dashboard. Logo YieldLogo avec animate-pulse — plus chaleureux qu'un
// simple spinner border, et cohérent visuellement avec l'identité YIELD.
//
// Réutilisé sur dashboard/page, profile, invoices/[id], recipes/[id], etc.
// pour qu'un chef ne voie jamais 2 designs de loader différents en navigant.

import { YieldLogo } from "@/app/_components/YieldLogo";

export function PageSpinner({ label }: { label?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3"
      style={{ background: "#F7F9FF" }}
      role="status"
      aria-live="polite"
    >
      <div className="w-10 h-10 rounded-2xl btn-primary flex items-center justify-center animate-pulse">
        <YieldLogo size={18} className="text-white" />
      </div>
      {label && <p className="text-slate-400 text-xs">{label}</p>}
    </div>
  );
}
