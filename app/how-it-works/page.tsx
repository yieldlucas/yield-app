// /how-it-works — Page explicative qui synthétise la promesse Yield en 3
// étapes. Sert de référence pour les CTA "Comment ça marche ?" du dashboard
// et de l'onboarding.
//
// Volontairement statique (pas d'auth requise) pour pouvoir être linkée depuis
// l'extérieur (réponses Slack, emails de support, landing publique).

import Link from "next/link";
import {
  ArrowLeft, Bell, Camera, LineChart, ScanLine, Salad, Sparkles,
} from "lucide-react";
import { YieldLogo } from "@/app/_components/YieldLogo";

export const metadata = {
  title: "Comment Yield fonctionne",
  description:
    "Scannez vos bons de livraison, composez vos plats, pilotez vos marges en temps réel.",
};

const STEPS = [
  {
    n: "01",
    label: "Le Moteur",
    title: "Scanner vos bons de livraison",
    desc: "Photographiez le BL à la réception. Yield extrait chaque ligne (produit, quantité, prix) et alimente votre base de prix automatiquement.",
    Icon: Camera,
    accent: "bg-blue-50 text-blue-700 border-blue-100",
    badge: "bg-blue-600",
  },
  {
    n: "02",
    label: "La Composition",
    title: "Enregistrer vos plats",
    desc: "Composez vos recettes dans la calculatrice (côte de bœuf + frites + garniture…). Chaque ingrédient est lié au dernier prix d'achat scanné.",
    Icon: YieldLogo,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-100",
    badge: "bg-emerald-600",
  },
  {
    n: "03",
    label: "Le Pilotage",
    title: "Piloter vos marges en temps réel",
    desc: "Dès qu'un fournisseur augmente, vos plats clignotent dans Mes Recettes. Ajustez la portion ou le prix de vente en 30 secondes — sans alertes intempestives.",
    Icon: LineChart,
    accent: "bg-violet-50 text-violet-700 border-violet-100",
    badge: "bg-violet-600",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 py-10 px-5">
      <div className="max-w-2xl mx-auto">
        {/* Retour */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Retour au dashboard
        </Link>

        {/* Hero */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider mb-4">
            <Sparkles size={12} /> Comment ça marche
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight mb-3">
            Trois étapes,
            <br className="sm:hidden" />
            <span className="gradient-text"> un cercle vertueux</span>
          </h1>
          <p className="text-slate-500 text-base leading-relaxed max-w-md mx-auto">
            Scannez, composez, pilotez. Vos factures alimentent vos recettes,
            vos recettes vous alertent quand vos marges glissent.
          </p>
        </header>

        {/* Étapes */}
        <ol className="space-y-5 mb-12">
          {STEPS.map((s, i) => (
            <li key={s.n} className="relative">
              {/* Ligne verticale entre les étapes */}
              {i < STEPS.length - 1 && (
                <div className="absolute left-[34px] top-[88px] bottom-[-20px] w-px bg-gradient-to-b from-slate-200 to-transparent hidden sm:block" />
              )}
              <div className="relative bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm flex items-start gap-4 sm:gap-5">
                {/* Icône + numéro */}
                <div className="flex-shrink-0 relative">
                  <div className={`w-16 h-16 rounded-2xl ${s.accent} border flex items-center justify-center`}>
                    <s.Icon size={26} />
                  </div>
                  <span className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full ${s.badge} text-white text-[10px] font-bold flex items-center justify-center shadow-sm`}>
                    {s.n}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {s.label}
                  </p>
                  <h2 className="text-slate-900 font-bold text-base sm:text-lg leading-tight mb-1.5">
                    {s.title}
                  </h2>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* La synergie */}
        <section className="rounded-2xl border border-slate-100 bg-gradient-to-br from-blue-50/50 via-white to-emerald-50/50 p-6 sm:p-8 mb-10">
          <h2 className="text-slate-900 font-bold text-base mb-2 flex items-center gap-2">
            <Bell size={16} className="text-amber-500" />
            La promesse : zéro bruit, zéro angle mort.
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Yield ne vous spamme pas de notifications. L&apos;information
            sensible (dérive de coût, marge sous le seuil) reste latente dans
            <strong> Mes Recettes</strong>. Vous y allez quand <em>vous</em>
            décidez. Le widget <em>Santé de votre Carte</em> sur le dashboard
            vous indique simplement combien de plats nécessitent votre
            attention — sans interrompre votre service.
          </p>
        </section>

        {/* CTA double */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard"
            className="rounded-2xl border border-blue-200 bg-blue-600 text-white p-5 flex items-center justify-between hover:bg-blue-700 transition-colors"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Étape 1</p>
              <p className="font-bold text-sm">Scanner ma 1ère facture</p>
            </div>
            <ScanLine size={18} />
          </Link>
          <Link
            href="/dashboard/recipes"
            className="rounded-2xl border border-emerald-200 bg-white text-emerald-700 p-5 flex items-center justify-between hover:bg-emerald-50 transition-colors"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Étape 2</p>
              <p className="font-bold text-sm">Voir mes recettes</p>
            </div>
            <Salad size={18} />
          </Link>
        </div>

        <p className="text-center text-[12px] text-slate-400 mt-10">
          Une question ?
          <a href="mailto:lucasyieldapp@gmail.com" className="underline ml-1 hover:text-slate-600">
            lucasyieldapp@gmail.com
          </a>
          {" · "}
          <Link href="/dashboard" className="underline hover:text-slate-600">
            Retour
          </Link>
        </p>
      </div>
    </main>
  );
}
