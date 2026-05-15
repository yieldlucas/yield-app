import Link from "next/link";
import { YieldLogo } from "@/app/_components/YieldLogo";

// [audit-fix R3] Politique de confidentialité conforme RGPD. Les champs
// « À COMPLÉTER » entre crochets sont vérifiés par le hook prebuild
// (scripts/check-legal-placeholders.ts). Le déploiement production échoue
// tant qu'au moins un placeholder reste — voir docs/deployment-notes.md.
//
// Document à FAIRE RELIRE PAR UN AVOCAT / DPO (Captain Contrat / LegalPlace)
// avant le premier paiement encaissé. La rédaction ci-dessous est sérieuse
// et complète pour un SaaS B2B FR mais n'est PAS un avis juridique.

export const metadata = {
  title: "Politique de Confidentialité — Yield",
  description: "Comment Yield collecte, utilise et protège les données de ses utilisateurs (RGPD).",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-5">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-100 p-8 sm:p-12 shadow-sm">
        <Link href="/" className="flex items-center gap-2 mb-8 text-slate-600 hover:text-blue-600 transition-colors">
          <YieldLogo size={18} className="text-blue-600" />
          <span className="font-black gradient-text">YIELD</span>
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Politique de Confidentialité</h1>
        <p className="text-slate-400 text-sm mb-10">
          Date d&apos;entrée en vigueur : <span data-todo>[À COMPLÉTER : date d&apos;entrée en vigueur — DD/MM/YYYY]</span>
        </p>

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données personnelles collectées via le Service
            Yield est <strong>[À COMPLÉTER : raison sociale exacte]</strong>, dont le siège social est situé{" "}
            <span data-todo>[À COMPLÉTER : adresse postale complète]</span>, immatriculée au{" "}
            <span data-todo>[À COMPLÉTER : RCS ville et numéro - &quot;Non applicable (EI)&quot; si auto-entrepreneur]</span>{" "}
            sous le numéro SIRET <span data-todo>[À COMPLÉTER : SIRET 14 chiffres]</span>.
          </p>
          <p>
            Responsable de la protection des données :{" "}
            <span data-todo>[À COMPLÉTER : nom et prénom du DPO ou responsable de traitement RGPD - peut être identique au représentant légal pour une EI]</span>.
            Contact pour toute question relative aux données personnelles :{" "}
            <a href="mailto:chef@yieldapp.fr" className="text-blue-600 hover:underline">chef@yieldapp.fr</a>.
          </p>
        </Section>

        <Section title="2. Données collectées">
          <p>Yield collecte les catégories de données suivantes :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Données de compte</strong> : adresse e-mail, mot de passe (haché),
              nom du restaurant, date de création du compte.
            </li>
            <li>
              <strong>Données de facturation</strong> : identifiant Stripe customer,
              statut de l&apos;abonnement. Aucune donnée bancaire n&apos;est stockée par Yield —
              les paiements sont opérés directement par Stripe.
            </li>
            <li>
              <strong>Données métier</strong> : photos / PDF de bons de livraison, données
              extraites par l&apos;IA (fournisseur, produits, prix, quantités), historique
              des prix, recettes, alertes générées.
            </li>
            <li>
              <strong>Données techniques</strong> : adresse IP, type d&apos;appareil, logs
              d&apos;accès (à des fins de sécurité et de débogage).
            </li>
          </ul>
        </Section>

        <Section title="3. Finalités et bases légales">
          <p>Les données sont traitées pour les finalités suivantes :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Fourniture du Service</strong> (base légale : exécution du contrat) —
              authentification, scan, calcul des marges, alertes, exports.
            </li>
            <li>
              <strong>Facturation</strong> (base légale : exécution du contrat et obligation
              légale comptable) — gestion de l&apos;abonnement Stripe.
            </li>
            <li>
              <strong>Sécurité</strong> (base légale : intérêt légitime) — détection
              d&apos;abus, prévention de la fraude, journaux d&apos;accès.
            </li>
            <li>
              <strong>Communication</strong> (base légale : exécution du contrat ou intérêt
              légitime) — e-mails transactionnels (rappel fin d&apos;essai, paiement échoué,
              alertes prix). Le Client peut s&apos;opposer aux notifications non essentielles.
            </li>
          </ul>
        </Section>

        <Section title="4. Sous-traitants">
          <p>
            Yield s&apos;appuie sur les sous-traitants suivants pour fournir le Service. Tous
            sont liés par un contrat conforme à l&apos;article 28 du RGPD :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Supabase Inc.</strong> (États-Unis) — hébergement de la base de données
              et stockage des fichiers, sur serveurs situés dans l&apos;Union Européenne (AWS
              Paris, eu-west-3). Transfert hors UE encadré par les Clauses Contractuelles
              Types (SCC) de la Commission européenne.{" "}
              <a href="https://supabase.com/privacy" className="text-blue-600 hover:underline">Politique Supabase</a>.
            </li>
            <li>
              <strong>Vercel Inc.</strong> (États-Unis) — hébergement de l&apos;application
              web. Couverture SCC.{" "}
              <a href="https://vercel.com/legal/privacy-policy" className="text-blue-600 hover:underline">Politique Vercel</a>.
            </li>
            <li>
              <strong>Stripe Payments Europe Ltd.</strong> (Irlande) — gestion des paiements
              et des abonnements. Couverture UE.{" "}
              <a href="https://stripe.com/privacy" className="text-blue-600 hover:underline">Politique Stripe</a>.
            </li>
            <li>
              <strong>Anthropic PBC</strong> (États-Unis) — analyse des bons de livraison
              par modèle d&apos;intelligence artificielle (Claude). Les fichiers transmis ne
              sont pas conservés par Anthropic au-delà du traitement et ne sont pas utilisés
              pour entraîner ses modèles. Couverture SCC.{" "}
              <a href="https://www.anthropic.com/legal/privacy" className="text-blue-600 hover:underline">Politique Anthropic</a>.
            </li>
            <li>
              <strong>Resend (Resend Inc.)</strong> (États-Unis) — envoi des e-mails
              transactionnels (bienvenue, codes de connexion OTP, rappels d&apos;essai,
              récap mensuel). Aucune utilisation publicitaire ou marketing tiers. Couverture
              SCC.{" "}
              <a href="https://resend.com/legal/privacy-policy" className="text-blue-600 hover:underline">Politique Resend</a>.
            </li>
            <li>
              <strong>Sentry (Functional Software, Inc.)</strong> (États-Unis) — monitoring
              des erreurs applicatives et alertes en cas d&apos;incident. Les données
              personnelles éventuellement contenues dans les rapports d&apos;erreur (e-mails,
              libellés produits, identifiants) sont filtrées et masquées avant transmission
              (mécanisme `beforeSend`). Couverture SCC.{" "}
              <a href="https://sentry.io/privacy/" className="text-blue-600 hover:underline">Politique Sentry</a>.
            </li>
          </ul>
        </Section>

        <Section title="4 bis. Transferts hors Union Européenne">
          <p>
            Certains sous-traitants ci-dessus sont établis hors de l&apos;Union Européenne
            (États-Unis principalement). Pour chaque transfert hors UE, Yield s&apos;assure
            que le sous-traitant offre un niveau de protection adéquat via :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              les <strong>Clauses Contractuelles Types (SCC)</strong> adoptées par la
              Commission européenne (décision 2021/914), incluses dans les Data Processing
              Agreements signés avec ces sous-traitants ; et / ou
            </li>
            <li>
              le cadre <strong>EU-US Data Privacy Framework</strong> (DPF) pour les
              sous-traitants américains certifiés.
            </li>
          </ul>
        </Section>

        <Section title="4 ter. Données métier sensibles">
          <p>
            Les données métier du Client (prix fournisseurs, libellés produits, fiches
            techniques recettes) ne sont pas des données personnelles au sens strict du
            RGPD, mais constituent des données commerciales sensibles. Yield s&apos;engage
            contractuellement à :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>ne pas divulguer ces données à des tiers ;</li>
            <li>ne pas les utiliser à des fins concurrentielles ou commerciales propres ;</li>
            <li>les protéger par les mêmes mesures de sécurité que les données personnelles
              (RLS, chiffrement, isolation par compte).</li>
          </ul>
          <p>
            Une future fonctionnalité de <strong>comparaison de prix anonymisée entre
            restaurateurs</strong> est envisagée. Cette fonctionnalité fera l&apos;objet d&apos;un
            <strong> consentement opt-in séparé et explicite</strong> au moment de son
            activation. Les données partagées seront strictement anonymisées par
            <strong> k-anonymisation</strong> (un produit ne sera inclus dans une statistique
            qu&apos;à partir d&apos;au moins 5 restaurateurs distincts), empêchant toute
            réidentification d&apos;un Client par croisement de prix.
          </p>
        </Section>

        <Section title="5. Durée de conservation">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Données de compte et métier</strong> : conservées tant que le compte
              est actif. Supprimées sous 30 jours après suppression du compte par le Client
              (fonction « Supprimer mon compte » dans le profil) ou après 24 mois
              d&apos;inactivité.
            </li>
            <li>
              <strong>Données de facturation</strong> : conservées 10 ans à compter de
              l&apos;émission de chaque facture, conformément à l&apos;obligation comptable
              française (article L.123-22 du Code de commerce).
            </li>
            <li>
              <strong>Logs techniques</strong> : conservés au maximum 12 mois.
            </li>
          </ul>
        </Section>

        <Section title="6. Droits des utilisateurs">
          <p>
            Conformément au RGPD (articles 15 à 22), le Client dispose des droits suivants
            sur ses données personnelles :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Droit d&apos;accès</strong> : obtenir une copie des données détenues.</li>
            <li><strong>Droit de rectification</strong> : corriger les données inexactes
              (l&apos;interface permet de modifier les libellés et prix extraits).</li>
            <li><strong>Droit à l&apos;effacement</strong> : supprimer le compte et toutes
              les données associées via le profil.</li>
            <li><strong>Droit à la portabilité</strong> : exporter les données au format
              CSV ou PDF depuis l&apos;interface.</li>
            <li><strong>Droit d&apos;opposition</strong> : refuser le traitement à des fins
              de communication non essentielle.</li>
            <li><strong>Droit de réclamation</strong> auprès de la CNIL (cnil.fr).</li>
          </ul>
          <p>
            Pour exercer ces droits, écrire à chef@yieldapp.fr. Réponse sous 30 jours
            maximum.
          </p>
        </Section>

        <Section title="7. Sécurité">
          <p>
            Yield met en œuvre des mesures techniques et organisationnelles appropriées
            pour protéger les données :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Chiffrement TLS 1.2+ pour tous les échanges client-serveur.</li>
            <li>Chiffrement au repos (AES-256) pour les fichiers stockés.</li>
            <li>Mots de passe stockés sous forme de haché bcrypt (Supabase Auth).</li>
            <li>Row Level Security (RLS) sur toutes les tables — chaque utilisateur ne
              peut accéder qu&apos;à ses propres données, garanti au niveau base de données.</li>
            <li>Journalisation des accès et alertes en cas d&apos;activité suspecte.</li>
          </ul>
        </Section>

        <Section title="8. Cookies">
          <p>
            Yield utilise uniquement des cookies strictement nécessaires au fonctionnement
            du Service (session d&apos;authentification, préférences d&apos;interface). Aucun
            cookie tiers de tracking publicitaire ou analytique n&apos;est déployé sans
            consentement explicite.
          </p>
        </Section>

        <Section title="9. Modifications">
          <p>
            La présente politique peut être modifiée. Les modifications substantielles
            seront notifiées par e-mail au moins 30 jours avant entrée en vigueur.
          </p>
        </Section>

        <p className="mt-12 text-sm text-slate-400">
          Voir aussi : <Link href="/terms" className="text-blue-600 hover:underline">Conditions Générales d&apos;Utilisation</Link>.
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
