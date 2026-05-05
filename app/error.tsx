"use client";

// Error Boundary route-level (Next.js 15).
// Wrappe automatiquement tout ce qui est sous /app/*. Si un composant throw
// pendant le render, on affiche cet écran au lieu d'un crash blanc.
// Doit rester un Client Component.

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("ui/route", "Erreur de rendu", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Une erreur est survenue</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        Cette page n'a pas pu s'afficher correctement. Réessayez — si le problème
        persiste, contactez le support.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Réessayer
      </button>
      {error.digest ? (
        <p className="mt-4 text-xs text-slate-400">Référence : {error.digest}</p>
      ) : null}
    </div>
  );
}
