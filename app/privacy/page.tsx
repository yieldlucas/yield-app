import Link from "next/link";
import { YieldLogo } from "@/app/_components/YieldLogo";

// ⚠️  PLACEHOLDERS LÉGAUX À REMPLIR AVANT PROD
// ───────────────────────────────────────────
// Les champs [TODO] doivent être remplacés avec les VRAIES informations.
// Cette politique RGPD est inspirée des standards SaaS B2B FR (cnil.fr).
// FAIRE RELIRE PAR UN AVOCAT / DPO avant lancement.

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
        <p className="text-slate-400 text-sm mb-10">Dernière mise à jour : <span data-todo>[TODO date]</span></p>

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données personnelles collectées via le Service
            Yield est <strong>[TODO Yield SAS / SARL]</strong>, dont le siège social est situé
            <span data-todo>[TODO adresse]</span>, immatriculée au RCS de <span data-todo>[TODO ville]</span>
            sous le numéro <span data-todo>[TODO SIRET]</span>.
          </p>
          <p>
            Contact pour toute question relative aux données personnelles : chef@yieldapp.fr.
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
              Types (SCC) de la Commission européenne.
            </li>
            <li>
              <strong>Vercel Inc.</strong> (États-Unis) — hébergement de l&apos;application
              web. Couverture SCC.
            </li>
            <li>
              <strong>Stripe Payments Europe Ltd.</strong> (Irlande) — gestion des paiements
              et des abonnements. Couverture UE.
            </li>
            <li>
              <strong>Anthropic PBC</strong> (États-Unis) — analyse des bons de livraison
              par modèle d&apos;intelligence artificielle (Claude). Les fichiers transmis ne
              sont pas conservés par Anthropic au-delà du traitement et ne sont pas utilisés
              pour entraîner ses modèles. Couverture SCC.
            </li>
          </ul>
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
