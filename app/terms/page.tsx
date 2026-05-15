import Link from "next/link";
import { YieldLogo } from "@/app/_components/YieldLogo";

// [audit-fix R3] CGU et CGV fusionnées en V1 — séparation /cgu et /cgv à
// envisager au lancement du forfait Pro (cf docs/deployment-notes.md
// section "Fix audit R3"). Les champs « À COMPLÉTER » entre crochets sont
// vérifiés par le hook prebuild (scripts/check-legal-placeholders.ts).
// Le déploiement production échoue tant qu'au moins un placeholder reste.
//
// Document à FAIRE RELIRE PAR UN AVOCAT (Captain Contrat / LegalPlace,
// ~150 € HT) avant le premier paiement encaissé. La rédaction ci-dessous
// est sérieuse et complète pour un SaaS B2B FR mais n'est PAS un avis juridique.

export const metadata = {
  title: "Conditions Générales d'Utilisation — Yield",
  description: "Conditions Générales d'Utilisation et de Vente du service Yield (SaaS de pilotage des marges en restauration).",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-5">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-100 p-8 sm:p-12 shadow-sm">
        <Link href="/" className="flex items-center gap-2 mb-8 text-slate-600 hover:text-blue-600 transition-colors">
          <YieldLogo size={18} className="text-blue-600" />
          <span className="font-black gradient-text">YIELD</span>
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Conditions Générales d&apos;Utilisation et de Vente</h1>
        <p className="text-slate-400 text-sm mb-10">
          Date d&apos;entrée en vigueur : <span data-todo>[À COMPLÉTER : date d&apos;entrée en vigueur — DD/MM/YYYY]</span>
        </p>

        <Section title="1. Éditeur du service">
          <p>
            Le service Yield (ci-après « le Service ») est édité par <strong>[À COMPLÉTER : raison sociale exacte]</strong>,{" "}
            <span data-todo>[À COMPLÉTER : forme juridique - EI (auto-entrepreneur) ou EURL]</span> au capital de <span data-todo>[À COMPLÉTER : capital social - &quot;Capital de X €&quot; ou &quot;Non applicable (EI)&quot;]</span>,
            immatriculée au <span data-todo>[À COMPLÉTER : RCS ville et numéro - &quot;Non applicable (EI)&quot; si auto-entrepreneur]</span>, sous le numéro
            SIRET <span data-todo>[À COMPLÉTER : SIRET 14 chiffres]</span>, dont le siège social est situé{" "}
            <span data-todo>[À COMPLÉTER : adresse postale complète]</span>.
          </p>
          <p>
            Numéro TVA intracommunautaire : <span data-todo>[À COMPLÉTER : numéro TVA intracommunautaire - &quot;Non assujetti (franchise en base)&quot; si EI]</span>.<br />
            Directeur de la publication : <span data-todo>[À COMPLÉTER : nom et prénom du représentant légal]</span>.<br />
            Contact : <a href="mailto:chef@yieldapp.fr" className="text-blue-600 hover:underline">chef@yieldapp.fr</a>.
          </p>
          <p>
            Détail complet sur la page{" "}
            <Link href="/legal" className="text-blue-600 hover:underline">Mentions légales</Link>.
          </p>
        </Section>

        <Section title="2. Objet">
          <p>
            Le Service permet à des professionnels de la restauration (ci-après « le Client »)
            de scanner leurs bons de livraison fournisseurs, d&apos;en extraire automatiquement
            les lignes de produits et prix grâce à l&apos;intelligence artificielle, de suivre
            l&apos;évolution de leurs coûts matière et de recevoir des alertes en cas de hausse
            anormale des prix.
          </p>
          <p>
            Les présentes Conditions Générales (CGU/CGV) régissent l&apos;accès et l&apos;usage
            du Service. L&apos;utilisation du Service implique l&apos;acceptation pleine et entière
            des présentes conditions.
          </p>
        </Section>

        <Section title="3. Accès au service et compte">
          <p>
            L&apos;accès au Service nécessite la création d&apos;un compte avec une adresse e-mail
            valide et un mot de passe. Le Client garantit l&apos;exactitude des informations
            fournies et s&apos;engage à protéger la confidentialité de ses identifiants.
          </p>
          <p>
            Le Client est seul responsable de toutes les activités effectuées sous son compte.
            Toute connexion suspecte doit être signalée sans délai à chef@yieldapp.fr.
          </p>
        </Section>

        <Section title="4. Essai gratuit, abonnement et tarifs">
          <p>
            Le Service propose un essai gratuit de quatorze (14) jours sans engagement,
            accessible après inscription. À l&apos;issue de cette période, l&apos;accès au Service
            requiert la souscription à une formule payante.
          </p>
          <p>
            Le tarif en vigueur est de 19,99 € HT/mois (formule Lancement), indiqué sur la page
            d&apos;accueil. La facturation est mensuelle, automatique et renouvelable par tacite
            reconduction tant que le Client n&apos;a pas résilié. Les paiements sont opérés via
            Stripe (Stripe Payments Europe, Limited). Une formule Pro à 39,99 € HT/mois
            (scans illimités, espace comptable, multi-établissements) sera proposée
            ultérieurement et ne s&apos;applique pas aux présentes conditions tant qu&apos;elle
            n&apos;est pas commercialisée.
          </p>
          <p>
            Le quota mensuel inclus dans la formule Lancement est de 200 scans. Au-delà, le
            compteur se réinitialise automatiquement le 1er du mois suivant. Aucune facturation
            additionnelle n&apos;est appliquée.
          </p>
        </Section>

        <Section title="5. Droit de rétractation">
          <p>
            Le Service étant destiné aux professionnels (B2B), le droit de rétractation
            de quatorze (14) jours prévu à l&apos;article L.221-18 du Code de la consommation
            ne s&apos;applique pas aux contrats conclus pour les besoins de l&apos;activité
            professionnelle du Client (article L.221-3 du même code).
          </p>
          <p>
            Toutefois, l&apos;essai gratuit de 14 jours permet au Client d&apos;évaluer
            le Service sans engagement avant tout paiement.
          </p>
        </Section>

        <Section title="6. Résiliation">
          <p>
            Le Client peut résilier son abonnement à tout moment depuis l&apos;interface
            de gestion de l&apos;abonnement (Stripe Billing Portal). La résiliation prend
            effet à la fin de la période en cours déjà payée, sans remboursement au prorata.
          </p>
          <p>
            Yield se réserve le droit de suspendre ou résilier l&apos;accès au Service en cas
            de violation des présentes CGU, notamment en cas d&apos;usage frauduleux,
            d&apos;impayé persistant ou de tentative d&apos;accès non autorisé aux systèmes.
          </p>
        </Section>

        <Section title="6 bis. Garantie satisfait ou remboursé (7 jours)">
          <p>
            Indépendamment de l&apos;exclusion légale du droit de rétractation B2B
            visée à l&apos;article 5, Yield consent contractuellement au Client une
            <strong> garantie « satisfait ou remboursé »</strong> portant sur toute
            facturation effectuée au titre de l&apos;abonnement.
          </p>
          <p>
            Le Client peut, dans un délai de <strong>sept (7) jours calendaires</strong>
            à compter de la date d&apos;émission d&apos;une facture (essai gratuit, premier
            paiement ou tout renouvellement mensuel), demander le remboursement intégral
            de cette facture en adressant un simple e-mail à
            chef@yieldapp.fr. Aucune justification n&apos;est requise.
          </p>
          <p>
            Le remboursement est effectué sur le moyen de paiement initial dans un délai
            maximum de quatorze (14) jours suivant la réception de la demande. L&apos;accès
            au Service est résilié au moment du remboursement.
          </p>
          <p>
            Au-delà de ce délai de sept (7) jours, les sommes versées ne sont plus
            remboursables, conformément aux articles 5 et 6 ci-dessus, sauf accord
            commercial exceptionnel et écrit de Yield.
          </p>
        </Section>

        <Section title="7. Disponibilité et qualité du service">
          <p>
            Yield s&apos;engage à fournir le Service avec diligence, dans le respect d&apos;une
            obligation de moyens. L&apos;extraction automatique des données de facture par
            intelligence artificielle peut comporter des erreurs ; le Client est invité
            à vérifier et corriger les données extraites depuis l&apos;interface de détail
            de chaque facture.
          </p>
          <p>
            Yield ne peut être tenue responsable des décisions commerciales prises par le
            Client sur la base des données fournies par le Service. Les calculs de marge
            et alertes sont des outils d&apos;aide à la décision et ne se substituent pas
            au jugement du Client.
          </p>
        </Section>

        <Section title="8. Données et confidentialité">
          <p>
            Les bons de livraison scannés et les données associées sont la propriété
            exclusive du Client. Yield s&apos;engage à ne pas les exploiter à d&apos;autres
            fins que la fourniture du Service. Le détail du traitement des données
            personnelles est décrit dans la <Link href="/privacy" className="text-blue-600 hover:underline">Politique de confidentialité</Link>.
          </p>
        </Section>

        <Section title="9. Propriété intellectuelle">
          <p>
            Le Service, son interface, ses algorithmes, sa marque et son code source restent
            la propriété exclusive de Yield. Aucun droit de propriété intellectuelle n&apos;est
            transféré au Client par les présentes.
          </p>
          <p>
            Le Client conserve l&apos;intégralité des droits sur les données qu&apos;il importe
            (factures, photos, libellés produits) et peut les exporter ou les supprimer
            à tout moment.
          </p>
        </Section>

        <Section title="10. Force majeure">
          <p>
            Yield ne saurait être tenue responsable d&apos;un manquement à ses obligations
            résultant d&apos;un cas de force majeure au sens de l&apos;article 1218 du Code
            civil (panne d&apos;un fournisseur tiers comme Vercel, Supabase, Stripe ou
            Anthropic, attaque informatique, catastrophe naturelle, etc.).
          </p>
        </Section>

        <Section title="11. Droit applicable et juridiction">
          <p>
            Les présentes CGU sont soumises au droit français. En cas de litige, et après
            tentative de résolution amiable, les tribunaux de <span data-todo>[À COMPLÉTER : juridiction compétente en cas de litige - tribunal de la ville du siège]</span> seront seuls compétents, nonobstant pluralité de défendeurs
            ou appel en garantie.
          </p>
        </Section>

        <Section title="12. Modifications">
          <p>
            Yield se réserve le droit de modifier les présentes CGU à tout moment.
            Les modifications substantielles seront notifiées au Client par e-mail
            au moins trente (30) jours avant leur entrée en vigueur. Le Client pourra
            résilier son abonnement sans frais s&apos;il refuse les nouvelles conditions.
          </p>
        </Section>

        <p className="mt-12 text-sm text-slate-400">
          Voir aussi : <Link href="/privacy" className="text-blue-600 hover:underline">Politique de confidentialité</Link>.
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
