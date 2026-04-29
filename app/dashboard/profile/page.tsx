"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ChefHat, ArrowLeft, Mail, Building2, Crown, ShieldCheck,
  CreditCard, AlertTriangle, CheckCircle2, LogOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { clearStack } from "@/lib/scan-stack";

type Profile = {
  email: string;
  restaurant_name: string | null;
  is_subscribed: boolean;
  stripe_customer_id: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/"); return; }
      const { data, error } = await supabase
        .from("profiles")
        .select("restaurant_name, is_subscribed, stripe_customer_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        setErrorMsg("Impossible de charger votre profil.");
      }

      const p: Profile = {
        email: session.user.email ?? "",
        restaurant_name: (data as { restaurant_name?: string | null } | null)?.restaurant_name ?? null,
        is_subscribed: Boolean((data as { is_subscribed?: boolean } | null)?.is_subscribed),
        stripe_customer_id: (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null,
      };
      setProfile(p);
      setRestaurantName(p.restaurant_name ?? "");
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const callApi = async (path: string, init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); throw new Error("No session"); }
    return fetch(path, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${session.access_token}` },
    });
  };

  const saveName = async () => {
    if (!profile) return;
    setSavingName(true);
    setNameSaved(false);
    setErrorMsg("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ restaurant_name: restaurantName.trim() || null })
      .eq("id", session.user.id);
    setSavingName(false);
    if (error) {
      setErrorMsg("Échec de la sauvegarde.");
      return;
    }
    setNameSaved(true);
    setProfile({ ...profile, restaurant_name: restaurantName.trim() || null });
    setTimeout(() => setNameSaved(false), 2500);
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await callApi("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      throw new Error(data.error ?? "Portal failed");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Portail indisponible");
      setPortalLoading(false);
    }
  };

  const startCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await callApi("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      throw new Error(data.error ?? "Checkout failed");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Paiement indisponible");
      setCheckoutLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== "SUPPRIMER") return;
    setDeleting(true);
    setErrorMsg("");
    try {
      const res = await callApi("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Suppression échouée");
      }
      await clearStack();
      await supabase.auth.signOut();
      router.replace("/");
    } catch (e) {
      setDeleting(false);
      setErrorMsg(e instanceof Error ? e.message : "Suppression échouée");
    }
  };

  const signOut = async () => {
    // On vide le stack IDB pour pas exposer les photos d'un user au compte
    // suivant qui se connecterait sur le même device.
    await clearStack();
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F9FF" }}>
        <div className="w-10 h-10 rounded-2xl btn-primary flex items-center justify-center animate-pulse">
          <ChefHat size={18} className="text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: "#F7F9FF" }}>

      {/* Header */}
      <div className="glass-nav sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Tableau de bord</span>
          </Link>
          <span className="font-black text-base tracking-tight gradient-text">YIELD</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-6 space-y-6">

        {/* Avatar + nom */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card rounded-3xl p-6 flex items-center gap-4">
          <div className="w-16 h-16 btn-primary rounded-2xl flex items-center justify-center flex-shrink-0">
            <ChefHat size={28} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 font-bold text-lg truncate">
              {profile?.restaurant_name || "Votre restaurant"}
            </p>
            <p className="text-slate-400 text-sm truncate">{profile?.email}</p>
          </div>
          {profile?.is_subscribed && (
            <div className="label-blue px-2.5 py-1 rounded-full flex items-center gap-1 flex-shrink-0">
              <Crown size={12} className="text-blue-600" />
              <span className="text-blue-700 text-[10px] font-bold uppercase tracking-wider">Pro</span>
            </div>
          )}
        </motion.div>

        {/* Email (lecture seule) */}
        <section>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 px-1">Compte</h2>
          <div className="card rounded-2xl divide-y divide-slate-100">
            <div className="px-5 py-4 flex items-center gap-3">
              <Mail size={16} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-400 text-xs">Email</p>
                <p className="text-slate-800 text-sm font-medium truncate">{profile?.email}</p>
              </div>
              <span className="text-xs text-slate-400">Non modifiable</span>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-2">
                <Building2 size={16} className="text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-slate-400 text-xs">Nom du restaurant</p>
                </div>
              </div>
              <input
                type="text"
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                placeholder="Ex : Le Comptoir du Marché"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <div className="flex items-center justify-between mt-3">
                {nameSaved ? (
                  <span className="text-emerald-600 text-xs flex items-center gap-1">
                    <CheckCircle2 size={13} /> Enregistré
                  </span>
                ) : <span />}
                <button
                  onClick={saveName}
                  disabled={savingName || (restaurantName ?? "").trim() === (profile?.restaurant_name ?? "")}
                  className="btn-primary px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {savingName ? (
                    <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sauvegarde…</>
                  ) : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Abonnement */}
        <section>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 px-1">Abonnement</h2>
          {profile?.is_subscribed ? (
            <div className="card rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 label-blue rounded-xl flex items-center justify-center flex-shrink-0">
                  <Crown size={16} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 font-semibold text-sm">YIELD Pro</p>
                  <p className="text-slate-400 text-xs">Scans illimités · Alertes temps réel · Conciergerie</p>
                </div>
              </div>
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {portalLoading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Ouverture du portail…</>
                ) : (
                  <><CreditCard size={15} /> Gérer mon abonnement / Factures</>
                )}
              </button>
              <p className="text-slate-400 text-[11px] text-center mt-3">
                Mise à jour de la carte, factures, résiliation — directement chez Stripe.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: "linear-gradient(145deg, #1D4ED8, #2563EB 50%, #4F46E5)" }}>
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 80% 30%, rgba(255,255,255,0.14) 0%, transparent 60%)" }} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Crown size={14} className="text-blue-200" />
                  <span className="text-blue-200 text-xs font-semibold uppercase tracking-wider">YIELD Pro</span>
                </div>
                <p className="text-2xl font-bold mb-1">14 jours offerts</p>
                <p className="text-blue-100 text-sm mb-4">Scans illimités, alertes rendement, conciergerie chef. Sans engagement.</p>
                <button
                  onClick={startCheckout}
                  disabled={checkoutLoading}
                  className="w-full bg-white text-blue-700 font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors disabled:opacity-70"
                >
                  {checkoutLoading ? (
                    <><div className="w-4 h-4 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin" /> Ouverture du paiement…</>
                  ) : "Démarrer l'essai"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Sécurité */}
        <section>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 px-1">Sécurité</h2>
          <div className="card rounded-2xl divide-y divide-slate-100">
            <div className="px-5 py-4 flex items-center gap-3">
              <ShieldCheck size={16} className="text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-800 text-sm font-medium">Connexion sans mot de passe</p>
                <p className="text-slate-400 text-xs">Code OTP envoyé par email à chaque session</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
            >
              <LogOut size={16} className="text-slate-400 flex-shrink-0" />
              <span className="flex-1 text-slate-700 text-sm font-medium">Se déconnecter</span>
            </button>
          </div>
        </section>

        {/* Zone de danger */}
        <section>
          <h2 className="text-red-500 text-xs font-semibold uppercase tracking-wider mb-3 px-1">Zone de danger</h2>
          <div className="rounded-2xl p-5 border-2 border-red-100 bg-red-50/30">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-semibold text-sm mb-1">Supprimer mon compte</p>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Toutes vos données — bons de livraison, alertes, historique de prix — seront supprimées de manière irréversible. Cette action est définitive.
                </p>
              </div>
            </div>
            {!showDelete ? (
              <button
                onClick={() => setShowDelete(true)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
              >
                Je veux supprimer mon compte
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-700 text-xs">
                  Pour confirmer, tapez <span className="font-mono font-bold text-red-600">SUPPRIMER</span> ci-dessous :
                </p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="w-full bg-white border-2 border-red-200 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder:text-slate-300 text-sm focus:outline-none focus:border-red-400 transition-all font-mono uppercase"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={deleteAccount}
                    disabled={deleting || deleteConfirm.trim().toUpperCase() !== "SUPPRIMER"}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {deleting ? "Suppression…" : "Supprimer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {errorMsg && (
          <div className="rounded-xl p-3 bg-red-50 border border-red-200 text-red-600 text-xs">{errorMsg}</div>
        )}

        <p className="text-center text-slate-300 text-xs pt-4 pb-2">YIELD · v1.0</p>
      </div>
    </div>
  );
}
