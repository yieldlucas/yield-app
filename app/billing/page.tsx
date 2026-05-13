"use client";

// Page /billing — lien d'atterrissage pour les CTA des emails de relance.
// Présente le forfait + bouton checkout, ou le statut + bouton portail Stripe
// si déjà subscribed. Volontairement minimaliste : c'est un tunnel d'achat,
// pas un dashboard de pricing complet.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, ChefHat, ChevronRight, Crown, Settings, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

export default function BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_subscribed")
        .eq("id", session.user.id)
        .maybeSingle();
      setIsSubscribed(Boolean((profile as { is_subscribed?: boolean } | null)?.is_subscribed));
      setLoading(false);
    })();
  }, [router]);

  /** Wrapper fetch avec Bearer JWT — comme dans le dashboard. */
  const callApi = async (path: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/");
      throw new Error("No session");
    }
    return fetch(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  };

  const startCheckout = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await callApi("/api/checkout");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Erreur ${res.status}`);
      if (!data.url) throw new Error("URL Stripe manquante");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paiement indisponible");
      setActionLoading(false);
    }
  };

  const openPortal = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await callApi("/api/billing/portal");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Erreur ${res.status}`);
      if (!data.url) throw new Error("URL portail manquante");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portail indisponible");
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="max-w-md mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Retour au dashboard
        </Link>

        <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <ChefHat size={20} className="text-blue-600" />
            <span className="font-black text-base gradient-text">YIELD</span>
          </div>

          {isSubscribed ? (
            <SubscribedView onPortal={openPortal} loading={actionLoading} />
          ) : (
            <CheckoutView onCheckout={startCheckout} loading={actionLoading} />
          )}

          {error && (
            <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3" role="alert">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/terms" className="hover:text-slate-600">CGU</Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-slate-600">Confidentialité</Link>
        </p>
      </div>
    </main>
  );
}

function CheckoutView({ onCheckout, loading }: { onCheckout: () => void; loading: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <Crown size={14} className="text-blue-600" />
        <span className="text-blue-600 text-[11px] font-semibold uppercase tracking-wider">
          Forfait Lancement
        </span>
      </div>
      <h1 className="text-3xl font-bold text-slate-900 mb-1">19,99 €</h1>
      <p className="text-slate-400 text-sm mb-6">HT/mois · Sans engagement · Résiliable en 1 clic</p>

      <ul className="space-y-2.5 mb-7 text-sm text-slate-600">
        {[
          "200 scans de bons de livraison par mois",
          "Alertes prix en temps réel",
          "Exports comptables PDF + CSV",
          "Conciergerie chef sous 2h",
          "Données stockées en France (Supabase EU)",
        ].map((feat) => (
          <li key={feat} className="flex gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onCheckout}
        disabled={loading}
        className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Ouverture du paiement…
          </>
        ) : (
          <>
            S&apos;abonner maintenant <ChevronRight size={15} />
          </>
        )}
      </button>

      <RefundGuarantee />
    </>
  );
}

/** Callout "Garantie 7j sans question" — sert deux objectifs :
 *  1. Rassure le chef qui hésite à entrer sa CB (effet conversion connu).
 *  2. Cadre publiquement notre politique : remboursement intégral si demande
 *     dans les 7j d'une facturation. Au-delà, plus de refund automatique →
 *     cap le risque chargebacks à 2-3 semaines après renouvellement plutôt
 *     que 60-90j (délai légal des banques).
 *  Doit rester aligné avec la clause CGU §6 (terms/page.tsx). */
function RefundGuarantee() {
  return (
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 flex items-start gap-2.5">
      <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-emerald-900 text-[13px] font-semibold leading-tight">
          Garantie satisfait ou remboursé 7 jours
        </p>
        <p className="text-emerald-800/80 text-[11px] leading-snug mt-0.5">
          Remboursement intégral sans question dans les 7 jours suivant toute
          facturation. Un email à chef@yieldapp.fr suffit.
        </p>
      </div>
    </div>
  );
}

function SubscribedView({ onPortal, loading }: { onPortal: () => void; loading: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 size={14} className="text-emerald-500" />
        <span className="text-emerald-600 text-[11px] font-semibold uppercase tracking-wider">
          Abonnement actif
        </span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Vous êtes déjà chez Yield</h1>
      <p className="text-slate-500 text-sm mb-6">
        Pour modifier votre paiement, télécharger vos factures, ou résilier,
        ouvrez le portail de gestion Stripe.
      </p>

      <button
        onClick={onPortal}
        disabled={loading}
        className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Ouverture du portail…
          </>
        ) : (
          <>
            <Settings size={15} /> Gérer mon abonnement
          </>
        )}
      </button>

      <RefundGuarantee />
    </>
  );
}
