import Link from "next/link";
import { YieldLogo } from "@/app/_components/YieldLogo";

// [audit-fix R3] mentions légales LCEN (loi 2004-575 art. 6 III).
// Les champs [À COMPLÉTER : ...] sont vérifiés par le hook prebuild
// (scripts/check-legal-placeholders.ts). Le déploiement production échoue
// tant qu'au moins un placeholder reste — voir docs/deployment-notes.md.
//
// Document à FAIRE RELIRE PAR UN AVOCAT (Captain Contrat / LegalPlace,
// ~150 € HT) avant le premier paiement encaissé. La rédaction ci-dessous
// est sérieuse et complète pour un SaaS B2B FR mais n'est PAS un avis juridique.

export const metadata = {
  title: "Mentions légales — Yield",
  description: "Mentions légales du service Yield (éditeur, hébergeur, directeur de publication) conformément à la LCEN.",
};

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-5">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-100 p-8 sm:p-12 shadow-sm">
        <Link href="/" className="flex items-center gap-2 mb-8 text-slate-600 hover:text-blue-600 transition-colors">
          <YieldLogo size={18} className="text-blue-600" />
          <span className="font-black gradient-text">YIELD</span>
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Mentions légales</h1>
        <p className="text-slate-400 text-sm mb-10">
          Dernière mise à jour : <span data-todo>[À COMPLÉTER : date d&apos;entrée en vigueur — DD/MM/YYYY]</span>
        </p>

        <Section title="1. Éditeur du site">
          <p>
            Le service Yield (ci-après « le Service ») accessible à l&apos;adresse{" "}
            <a href="https://www.yieldapp.fr" className="text-blue-600 hover:underline">www.yieldapp.fr</a>{" "}
            est édité par :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Raison sociale : <strong>[À COMPLÉTER : raison sociale exacte]</strong></li>
            <li>Forme juridique : <span data-todo>[À COMPLÉTER : forme juridique - EI (auto-entrepreneur) ou EURL]</span></li>
            <li>Capital social : <span data-todo>[À COMPLÉTER : capital social - &quot;Capital de X €&quot; ou &quot;Non applicable (EI)&quot;]</span></li>
            <li>SIRET : <span data-todo>[À COMPLÉTER : SIRET 14 chiffres]</span></li>
            <li>SIREN : <span data-todo>[À COMPLÉTER : SIREN 9 chiffres]</span></li>
            <li>Code APE/NAF : <span data-todo>[À COMPLÉTER : code APE/NAF]</span></li>
            <li>RCS : <span data-todo>[À COMPLÉTER : RCS ville et numéro - &quot;Non applicable (EI)&quot; si auto-entrepreneur]</span></li>
            <li>TVA intracommunautaire : <span data-todo>[À COMPLÉTER : numéro TVA intracommunautaire - &quot;Non assujetti (franchise en base)&quot; si EI]</span></li>
            <li>Siège social : <span data-todo>[À COMPLÉTER : adresse postale complète]</span></li>
            <li>E-mail : <a href="mailto:chef@yieldapp.fr" className="text-blue-600 hover:underline">chef@yieldapp.fr</a></li>
            <li>Téléphone : <span data-todo>[À COMPLÉTER : téléphone de contact - optionnel si email seul]</span></li>
          </ul>
        </Section>

        <Section title="2. Directeur de la publication">
          <p>
            <span data-todo>[À COMPLÉTER : nom et prénom du représentant légal]</span>,
            représentant légal de l&apos;éditeur.
          </p>
        </Section>

        <Section title="3. Hébergement">
          <p>
            <strong>Hébergement de l&apos;application web</strong> : Vercel Inc., 440 N Barranca
            Avenue #4133, Covina, CA 91723, États-Unis.{" "}
            <a href="https://vercel.com" className="text-blue-600 hover:underline">vercel.com</a>
          </p>
          <p>
            <strong>Hébergement de la base de données et des fichiers</strong> : Supabase Inc.
            (États-Unis), serveurs situés dans l&apos;Union Européenne (AWS Paris, région
            eu-west-3).{" "}
            <a href="https://supabase.com" className="text-blue-600 hover:underline">supabase.com</a>
          </p>
        </Section>

        <Section title="4. Responsable du traitement des données personnelles">
          <p>
            <span data-todo>[À COMPLÉTER : nom et prénom du DPO ou responsable de traitement RGPD - peut être identique au représentant légal pour une EI]</span>.
            Contact pour toute question relative à la protection des données personnelles :{" "}
            <a href="mailto:chef@yieldapp.fr" className="text-blue-600 hover:underline">chef@yieldapp.fr</a>.
          </p>
          <p>
            Le détail des traitements et des droits exercables sur les données personnelles est
            disponible dans la{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline">Politique de confidentialité</Link>.
          </p>
        </Section>

        <Section title="5. Propriété intellectuelle">
          <p>
            L&apos;ensemble du contenu du site (textes, graphismes, logo « Yield », interface,
            code source, base de données structurée) est protégé par le droit de la propriété
            intellectuelle. Toute reproduction, représentation, modification ou exploitation,
            partielle ou totale, sans autorisation écrite préalable, est interdite.
          </p>
        </Section>

        <Section title="6. Signalement de contenu illicite">
          <p>
            Conformément à l&apos;article 6 de la loi pour la confiance dans l&apos;économie
            numérique (LCEN), tout contenu manifestement illicite peut être signalé à{" "}
            <a href="mailto:chef@yieldapp.fr" className="text-blue-600 hover:underline">chef@yieldapp.fr</a>.
          </p>
        </Section>

        <p className="mt-12 text-sm text-slate-400">
          Voir aussi :{" "}
          <Link href="/terms" className="text-blue-600 hover:underline">Conditions Générales d&apos;Utilisation et de Vente</Link>
          {" · "}
          <Link href="/privacy" className="text-blue-600 hover:underline">Politique de confidentialité</Link>.
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-900 mb-3">{title}</h2>
      <div className="text-sm text-slate-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}
