import Link from "next/link";
import { ChefHat } from "lucide-react";

// ⚠️  PLACEHOLDERS LÉGAUX À REMPLIR AVANT PROD
// ───────────────────────────────────────────
// Les champs marqués [TODO] doivent être remplacés avec les VRAIES informations
// juridiques de Yield (forme sociale, SIRET, RCS, adresse siège, capital social,
// directeur de publication). Je n'invente pas ces valeurs.
//
// Ces CGU sont rédigées pour un SaaS B2B français, basées sur les standards
// usuels (Lemonway, Pennylane, Pappers etc.) — à FAIRE RELIRE PAR UN AVOCAT
// avant lancement, c'est cheap et ça couvre le risque contentieux.

export const metadata = {
  title: "Conditions Générales d'Utilisation — Yield",
  description: "Conditions Générales d'Utilisation et de Vente du service Yield (SaaS de pilotage des marges en restauration).",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-5">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-100 p-8 sm:p-12 shadow-sm">
        <Link href="/" className="flex items-center gap-2 mb-8 text-slate-600 hover:text-blue-600 transition-colors">
          <ChefHat size={18} className="text-blue-600" />
          <span className="font-black gradient-text">YIELD</span>
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Conditions Générales d&apos;Utilisation et de Vente</h1>
        <p className="text-slate-400 text-sm mb-10">Dernière mise à jour : <span data-todo>[TODO date]</span></p>

        <Section title="1. Éditeur du service">
          <p>
            Le service Yield (ci-après « le Service ») est édité par <strong>[TODO Yield SAS / SARL]</strong>,
            <span data-todo>[TODO forme sociale]</span> au capital de <span data-todo>[TODO capital]</span>,
            immatriculée au RCS de <span data-todo>[TODO ville]</span> sous le numéro
            <span data-todo>[TODO SIRET]</span>, dont le siège social est situé
            <span data-todo>[TODO adresse complète]</span>.
          </p>
          <p>
            Numéro TVA intracommunautaire : <span data-todo>[TODO FRXX...]</span>.<br />
            Directeur de la publication : <span data-todo>[TODO Nom Prénom]</span>.<br />
            Contact : chef@yield.restaurant.
          </p>
          <p>
            Hébergeur : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.<br />
            Hébergement des données : Supabase (AWS Paris, France — région eu-west-3).
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
            Toute connexion suspecte doit être signalée sans délai à chef@yield.restaurant.
          </p>
        </Section>

        <Section title="4. Essai gratuit, abonnement et tarifs">
          <p>
            Le Service propose un essai gratuit de quatorze (14) jours sans engagement,
            accessible après inscription. À l&apos;issue de cette période, l&apos;accès au Service
            requiert la souscription à une formule payante.
          </p>
          <p>
            Les tarifs en vigueur (Lancement à 19,99 € HT/mois, Pro à 39,99 € HT/mois) sont
            indiqués sur la page d&apos;accueil. La facturation est mensuelle, automatique et
            renouvelable par tacite reconduction tant que le Client n&apos;a pas résilié.
            Les paiements sont opérés via Stripe (Stripe Payments Europe, Limited).
          </p>
          <p>
            Le quota mensuel inclus dans la formule Lancement est de 200 scans. Au-delà,
            le Client peut passer à la formule Pro pour bénéficier d&apos;un quota supérieur.
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
            tentative de résolution amiable, les tribunaux de <span data-todo>[TODO ville
            du siège]</span> seront seuls compétents, nonobstant pluralité de défendeurs
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
