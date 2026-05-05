"use client";

// Fallback ultime : utilisé uniquement si l'erreur survient dans le root layout
// lui-même (avant que le <html>/<body> du layout soit monté). Doit donc
// fournir son propre <html> et <body>.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Le logger n'est volontairement PAS importé ici : si le bundle racine est
    // cassé, on évite tout import qui pourrait re-throw et écraser cet écran.
    console.error("[ui/global] Erreur racine", { digest: error.digest });
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 40,
          textAlign: "center",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
          Application indisponible
        </h1>
        <p style={{ color: "#475569", marginBottom: 24, maxWidth: 480 }}>
          Une erreur critique est survenue. Rechargez la page — si le problème
          persiste, contactez le support.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            background: "#2563eb",
            color: "white",
            border: 0,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Recharger
        </button>
        {error.digest ? (
          <p style={{ marginTop: 16, fontSize: 11, color: "#94a3b8" }}>
            Référence : {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
