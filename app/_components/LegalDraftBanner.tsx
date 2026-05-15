// [audit-fix R3] bandeau "draft" affiché en haut des pages légales tant
// que l'immatriculation officielle n'est pas finalisée.
//
// Pilotage par env var NEXT_PUBLIC_LEGAL_DRAFT :
//   - "true"  → bandeau visible (phase pré-SIRET)
//   - non défini ou autre → bandeau caché
//
// Procédure :
//   1. Pendant la phase pré-SIRET : NEXT_PUBLIC_LEGAL_DRAFT=true sur Vercel
//      preview ET production
//   2. Une fois les placeholders [À COMPLÉTER : ...] remplis : supprimer
//      la variable d'environnement Vercel
//   3. Le hook prebuild (scripts/check-legal-placeholders.ts) garantit qu'on
//      ne peut pas déployer en production avec des placeholders → cas
//      "production sans bandeau mais avec placeholders" impossible
//
// Voir docs/deployment-notes.md section "Fix audit R3".

export function LegalDraftBanner() {
  // Server component compatible : on lit NEXT_PUBLIC_* qui est inliné au
  // build dans le bundle, donc dispo côté serveur et client identiquement.
  if (process.env.NEXT_PUBLIC_LEGAL_DRAFT !== "true") return null;

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 flex items-start gap-3"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden className="text-amber-600 text-lg leading-none mt-0.5">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-amber-900 text-sm font-semibold leading-tight">
          Document en cours de finalisation
        </p>
        <p className="text-amber-800 text-xs leading-relaxed mt-1">
          Les valeurs définitives (raison sociale, SIRET, capital, adresse)
          seront ajoutées dès l&apos;immatriculation officielle de l&apos;entreprise.
          Cette page reste juridiquement opposable dans sa version finale.
        </p>
      </div>
    </div>
  );
}
