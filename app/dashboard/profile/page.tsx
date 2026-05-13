"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ChefHat, ArrowLeft, Mail, Building2, Crown, ShieldCheck,
  CreditCard, AlertTriangle, CheckCircle2, Copy, Gift, LogOut, Salad,
  Share2, Sparkles, Star, XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { clearStack } from "@/lib/scan-stack";
import { PageSpinner } from "../_components/PageSpinner";
import {
  fetchFounderInfo, fetchYourHistory, fetchReferralCount, applyReferralCode,
  type FounderInfo, type YourHistory,
} from "../_lib/founder-data";

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
  // Données rétention : membre fondateur, histoire, filleuls.
  const [founder, setFounder] = useState<FounderInfo | null>(null);
  const [history, setHistory] = useState<YourHistory | null>(null);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [codeCopied, setCodeCopied] = useState(false);
  // Saisie manuelle d'un code parrain (filleul qui n'est pas passé par le
  // lien). Erreurs typées renvoyées par la RPC → message contextuel pour
  // que l'user comprenne pourquoi son code est refusé.
  const [manualCode, setManualCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);

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

      // Fetch rétention en parallèle (non-bloquant). Affichés progressivement
      // dans les sections "Membre fondateur" + "Votre histoire" + "Parrainage".
      void fetchFounderInfo().then(async (f) => {
        setFounder(f);
        if (f?.referralCode) {
          setReferralCount(await fetchReferralCount(f.referralCode));
        }
      });
      void fetchYourHistory().then(setHistory);
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
    const newName = restaurantName.trim() || null;
    const { error } = await supabase
      .from("profiles")
      .update({ restaurant_name: newName })
      .eq("id", session.user.id);
    if (error) {
      setSavingName(false);
      setErrorMsg("Échec de la sauvegarde.");
      return;
    }

    // Sync vers la table restaurants : sans ça, la timeline et le PDF
    // continueraient d'afficher l'ancien nom (genre "Mon restaurant" auto-créé)
    // alors que le chef vient de renommer en "Le Bistrot Lyonnais". Best-effort —
    // si pas encore de ligne restaurants (premier scan pas encore fait), on skip.
    if (newName) {
      await supabase
        .from("restaurants")
        .update({ name: newName })
        .eq("owner_id", session.user.id);
    }

    setSavingName(false);
    setNameSaved(true);
    setProfile({ ...profile, restaurant_name: newName });
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

  /** Application manuelle d'un code parrain (l'user n'est pas passé par le
   *  lien ?ref=). Appelle la même RPC sécurisée que le flow auto.
   *  Affiche un message contextuel selon l'erreur typée renvoyée. */
  const submitManualCode = async () => {
    const code = manualCode.trim().toUpperCase();
    if (code.length < 4) {
      setApplyError("Code trop court. Format attendu : LETTRES-CHIFFRES (ex. MARC-A8F2).");
      return;
    }
    setApplying(true);
    setApplyError(null);
    setApplySuccess(false);
    const res = await applyReferralCode(code);
    setApplying(false);
    if (res.ok) {
      if (res.alreadyApplied) {
        setApplyError("Votre compte a déjà été parrainé.");
      } else {
        setApplySuccess(true);
        setManualCode("");
        // Refresh founder info pour mettre à jour referredByCode dans l'UI.
        const fresh = await fetchFounderInfo();
        setFounder(fresh);
      }
    } else {
      const messages: Record<string, string> = {
        invalid_code: "Ce code n'existe pas. Vérifiez avec votre parrain.",
        self_referral: "Vous ne pouvez pas utiliser votre propre code.",
        duplicate_account: "Un autre compte avec un email similaire existe déjà. Le bonus ne peut pas être appliqué.",
        not_authenticated: "Session expirée. Rechargez la page.",
        unknown: "Une erreur est survenue. Réessayez dans un instant.",
      };
      setApplyError(messages[res.error] ?? messages.unknown);
    }
  };

  /** Partage natif via Web Share API (ouvre WhatsApp / SMS / Mail sur mobile,
   *  fallback copy-to-clipboard sur desktop). Le message inclut le lien
   *  complet ?ref=CODE pour que le clic active automatiquement le bonus. */
  const shareReferral = async () => {
    if (!founder?.referralCode) return;
    if (typeof navigator === "undefined") return;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.yieldapp.fr";
    const url = `${appUrl}/?ref=${founder.referralCode}`;
    const text = `Je te parraine sur Yield (app pour surveiller les marges en cuisine). On a chacun 1 mois gratuit. Lien direct : ${url}`;
    // Tente le partage natif (Web Share API) → ouvre WhatsApp/SMS/Mail
    // selon ce que l'OS propose. Si absent ou user annule, fallback copy.
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: "Yield · Parrainage", text, url });
        return;
      } catch {
        // Annulation user ou pas de target compatible → on tombe sur le fallback
      }
    }
    // Fallback desktop : copie l'URL complète dans le presse-papiers.
    try {
      await nav.clipboard.writeText(url);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Sans Clipboard API → l'user fera select-all manuellement sur le code.
    }
  };

  if (loading) return <PageSpinner />;

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

        {/* ─── Membre fondateur — identité d'appartenance ─── */}
        {founder?.founderNumber != null && (
          <section>
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 px-1">
              Membre fondateur
            </h2>
            <div
              className="rounded-3xl p-5 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 60%, #7C3AED 100%)" }}
            >
              <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <Star size={26} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-0.5">
                    Membre fondateur · Yield
                  </p>
                  <p className="font-bold text-2xl leading-tight font-mono">
                    #{String(founder.founderNumber).padStart(3, "0")}
                  </p>
                  {founder.createdAt && (
                    <p className="text-white/80 text-[12px] mt-0.5">
                      Inscrit depuis le {new Date(founder.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Votre histoire avec Yield — l'investissement accumulé ─── */}
        {history != null && (
          <section>
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 px-1">
              Votre histoire avec Yield
            </h2>
            <div className="card rounded-2xl p-5 grid grid-cols-2 gap-4">
              <HistoryStat
                icon={<Sparkles size={14} className="text-blue-600" />}
                label="BL scannés"
                value={history.invoicesCount}
              />
              <HistoryStat
                icon={<AlertTriangle size={14} className="text-rose-500" />}
                label="Alertes détectées"
                value={history.alertsCount}
              />
              <HistoryStat
                icon={<Salad size={14} className="text-emerald-600" />}
                label="Recettes suivies"
                value={history.recipesCount}
              />
              <HistoryStat
                icon={<Building2 size={14} className="text-violet-600" />}
                label="Produits suivis"
                value={history.productsTracked}
              />
            </div>
          </section>
        )}

        {/* ─── Parrainage — saisie d'un code reçu + code à partager + filleuls ───
            La section apparait dès que founder est chargé, même si l'user n'a
            pas ENCORE son propre code (assign_founder_metadata pas encore
            tournée). Sinon, un filleul qui veut juste saisir un code reçu
            via SMS n'avait nulle part où le faire. */}
        {founder && (
          <section>
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 px-1">
              Parrainage
            </h2>

            {/* ── Sous-bloc 1 : "J'ai un code parrain" ── */}
            {/* Visible seulement si l'user n'a pas encore été parrainé. Une
                fois appliqué, ce bloc disparait au profit du bloc "Vous avez
                été parrainé par CODE" ci-dessous. */}
            {!founder.referredByCode && !applySuccess && (
              <div className="card rounded-2xl p-5 mb-3 border border-blue-100 bg-blue-50/40">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 border border-blue-100">
                    <Gift size={18} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-bold text-sm leading-tight">
                      Vous avez un code parrain ?
                    </p>
                    <p className="text-slate-500 text-[12px] leading-snug mt-0.5">
                      Saisissez-le pour recevoir <strong>30 jours d&apos;essai supplémentaires</strong>.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value.toUpperCase());
                      if (applyError) setApplyError(null);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") void submitManualCode(); }}
                    placeholder="MARC-A8F2"
                    maxLength={20}
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                  />
                  <button
                    onClick={() => void submitManualCode()}
                    disabled={applying || manualCode.trim().length < 4}
                    className="btn-primary px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {applying ? (
                      <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Activation…</>
                    ) : "Activer"}
                  </button>
                </div>
                {applyError && (
                  <p className="mt-2 text-rose-600 text-[12px] flex items-start gap-1.5" role="alert">
                    <XCircle size={13} className="flex-shrink-0 mt-0.5" /> {applyError}
                  </p>
                )}
              </div>
            )}

            {/* ── Confirmation si user vient d'appliquer un code manuellement ── */}
            {applySuccess && (
              <div className="card rounded-2xl p-4 mb-3 border border-emerald-200 bg-emerald-50">
                <p className="text-emerald-800 text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} /> Bonus activé : 30 jours d&apos;essai supplémentaires ajoutés à votre compte.
                </p>
              </div>
            )}

            {/* ── Info "Vous avez été parrainé par ..." si déjà appliqué ── */}
            {founder.referredByCode && !applySuccess && (
              <div className="card rounded-2xl p-4 mb-3 border border-emerald-100 bg-emerald-50/40 flex items-center gap-3">
                <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                <p className="text-slate-700 text-sm">
                  Vous avez été parrainé par <strong className="font-mono text-slate-900">{founder.referredByCode}</strong>.
                  Bonus de 30 jours actif.
                </p>
              </div>
            )}

            {/* ── Sous-bloc 2 : "Parrainez un collègue" — votre code à partager.
                Affiché seulement si l'user a un referralCode (sinon le bloc
                "Votre code en cours de génération" ci-dessous prend la place). */}
            {founder.referralCode ? (
            <div className="card rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                  <Share2 size={18} className="text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 font-bold text-sm leading-tight">
                    Parrainez un collègue
                  </p>
                  <p className="text-slate-500 text-[12px] leading-snug mt-0.5">
                    1 mois offert pour vous deux quand il s&apos;inscrit avec votre code.
                  </p>
                </div>
              </div>

              {/* Code affiché */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Votre code parrain
                </p>
                <div className="font-mono font-bold text-slate-900 tracking-wider text-2xl tabular-nums select-all">
                  {founder.referralCode}
                </div>
              </div>

              {/* 2 boutons : Partager (natif WhatsApp/SMS/Mail) + Copier le lien */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void shareReferral()}
                  className="btn-primary py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Share2 size={14} /> Partager le lien
                </button>
                <button
                  onClick={async () => {
                    if (!founder.referralCode) return;
                    try {
                      await navigator.clipboard.writeText(founder.referralCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    } catch {
                      // Clipboard bloquée → fallback sur select-all manuel
                    }
                  }}
                  className="py-2.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {codeCopied ? <><CheckCircle2 size={13} /> Copié</> : <><Copy size={13} /> Copier code</>}
                </button>
              </div>

              {/* Stat filleuls */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-slate-500 text-xs">
                  {referralCount === 0
                    ? "Aucun filleul pour l'instant."
                    : `${referralCount} chef${referralCount > 1 ? "s ont" : " a"} rejoint Yield grâce à vous.`}
                </p>
                {referralCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    +{referralCount} mois
                  </span>
                )}
              </div>
            </div>
            ) : (
              /* Code en cours de génération — backfill assign_founder_metadata
                 pas encore tourné ou migration 016 pas appliquée. Informatif
                 plutôt que cacher silencieusement. */
              <div className="card rounded-2xl p-4 border border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <Share2 size={15} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 text-[13px] font-semibold leading-tight">
                    Votre code parrain est en cours de génération
                  </p>
                  <p className="text-slate-400 text-[11px] leading-snug mt-0.5">
                    Rechargez la page dans quelques secondes. Vous pourrez alors le partager.
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

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
                <p className="text-blue-100 text-sm mb-1">
                  200 scans / mois, alertes prix temps réel, conciergerie chef.
                </p>
                <p className="text-blue-200 text-xs mb-4">
                  Puis <strong className="text-white">19,99 € HT/mois</strong> · Sans engagement · Résiliable en 1 clic
                </p>
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
                  Suppression définitive et immédiate de l&apos;ensemble de vos données :
                  bons de livraison, recettes, historique de prix, alertes. Conforme RGPD —
                  aucune sauvegarde n&apos;est conservée après la suppression. Préférez l&apos;export CSV
                  avant si vous voulez en garder une trace.
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

/** Petite stat carrée pour la grille "Votre histoire avec Yield". */
function HistoryStat({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
    </div>
  );
}
