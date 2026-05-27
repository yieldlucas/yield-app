"use client";

// Dashboard chef — orchestration top-level. Le JSX et la logique métier
// vivent dans /_components, /_hooks, /_lib pour rester compact ici.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, FolderOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { captureException } from "@sentry/nextjs";
import { supabase } from "@/lib/supabase-browser";
import { addToStack, listStack, removeFromStack, clearStack, type StackItem } from "@/lib/scan-stack";
import { openSignedExport } from "@/lib/export-download";

import { ScannerFAB } from "./_components/ScannerFAB";
import { CameraGuide } from "./_components/CameraGuide";
import { CameraCapture } from "./_components/CameraCapture";
import { StackTray } from "./_components/StackTray";
import { TrialBanner } from "./_components/TrialBanner";
import { ReferralTrialBanner } from "./_components/ReferralTrialBanner";
import { OnboardingModal } from "./_components/OnboardingModal";
import { ConciergeButton } from "./_components/ConciergeButton";
import { QuotaExceededModal } from "./_components/QuotaExceededModal";
import { InvoicesList, type InvoiceFilter } from "./_components/InvoicesList";
import { DashboardHeader } from "./_components/DashboardHeader";
import { MonthlyStatsStrip } from "./_components/MonthlyStatsStrip";
import { CardHealthWidget } from "./_components/CardHealthWidget";
import { DashboardHero } from "./_components/DashboardHero";
import { ScanReminderBanner } from "./_components/ScanReminderBanner";
import { FirstScanCelebration } from "./_components/FirstScanCelebration";
import { FounderLetter } from "./_components/FounderLetter";
import { EasterEggModal } from "./_components/EasterEggModal";
import { ReferralAppliedToast } from "./_components/ReferralAppliedToast";
import {
  fetchFounderInfo, markFounderLetterSeen, markOnboardingSeen, markFirstScanCelebrated,
  applyReferralCode, ensureFounderMetadata, computeTrialDaysLeft, type FounderInfo,
} from "./_lib/founder-data";
import { FlashCalculator, type CalculatorInitialIngredient } from "./_components/FlashCalculator";
import { fetchRecipesHealth } from "./_lib/recipes-data";
import { fetchInvoiceLinesForCalc, fetchRecentScansCount } from "./_lib/dashboard-data";
import {
  ActivatingBanner, ActivatedBanner, PaymentRequiredBanner, BillingErrorBanner,
} from "./_components/SubscriptionBanners";
import { type Alert, type RecentInvoice } from "./_components/types";
import { useStripeActivationPolling } from "./_hooks/useStripeActivationPolling";
import { useInvoicesPolling } from "./_hooks/useInvoicesPolling";
import {
  fetchUsage, fetchInvoices, invoicesChanged, fetchAlerts,
  markAlertRead, deleteInvoice, fetchMonthlyStats, type MonthlyStats,
} from "./_lib/dashboard-data";
import { type BatchInput } from "./_lib/process-batch";
import {
  useBatch, setBatchHandlers, startBatch, retryItem, dismissItem,
} from "./_lib/batch-store";

const QUOTA = 200;
const CAMERA_GUIDE_SEEN_KEY = "yield_camera_guide_seen";

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [invoices, setInvoices] = useState<RecentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  // True dès que le 1er fetch des factures a répondu. Sert à décider de
  // l'onboarding sans flash : on attend de connaître l'historique réel du
  // compte avant d'afficher (ou non) la modale d'accueil.
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTrial, setShowTrial] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [stripePollActive, setStripePollActive] = useState(false);
  const [activatingSubscription, setActivatingSubscription] = useState(false);
  const [subscriptionActivated, setSubscriptionActivated] = useState(false);
  // Lot de scans en cours : lu depuis le store global (survit à la navigation
  // entre /dashboard, /dashboard/recipes, /dashboard/profile).
  const { items: batchItems, running: batchRunning } = useBatch();
  const [cameraGuideOpen, setCameraGuideOpen] = useState(false);
  // Caméra intégrée (getUserMedia) — remplace le déclenchement <input capture>.
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stack, setStack] = useState<StackItem[]>([]);
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>("all");
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  // Pré-remplit la modal d'onboarding si le user a déjà saisi son nom
  // (re-onboarding manuel via /profile, ou ré-affichage forcé).
  const [restaurantName, setRestaurantName] = useState("");
  // Calculatrice de marge : state remonté ici pour que le header, le hero et
  // les cards facture puissent partager le même drawer.
  const [calcOpen, setCalcOpen] = useState(false);
  // Si non null, pré-remplit la calculatrice à l'ouverture (raccourci
  // "Créer une recette depuis cette facture"). Reset à la fermeture.
  const [calcSeed, setCalcSeed] = useState<CalculatorInitialIngredient[] | null>(null);
  // Stats des recettes pour le sous-texte du DashboardHero (Card B).
  const [recipesStats, setRecipesStats] = useState<{
    total: number; critical: number; warning: number;
  } | null>(null);
  // Compte des scans des 7 derniers jours — alimente le ScanReminderBanner.
  // Null = pas encore chargé (le banner ne s'affiche que sur chiffre connu).
  const [recentScans, setRecentScans] = useState<number | null>(null);
  // Infos "Membre fondateur" : numéro, code parrain, état lettre vue.
  // Null tant que pas chargé. Si la migration 016 n'est pas appliquée,
  // les champs internes seront null mais le state existe.
  const [founderInfo, setFounderInfo] = useState<FounderInfo | null>(null);
  // Toast de confirmation quand la RPC applique le bonus parrainage à
  // l'arrivée sur le dashboard. Valeur = nombre de jours crédités (30).
  // Null = pas d'application en cours, ne montre pas le toast.
  const [referralJustApplied, setReferralJustApplied] = useState<number | null>(null);
  // Permet de masquer le banner après dismiss (la persistance 3 jours est
  // gérée en localStorage côté ScanReminderBanner).
  const [reminderDismissed, setReminderDismissed] = useState(false);
  // Célébration premier scan : trigger une seule fois quand le count de
  // factures processed passe de 0 à 1. La persistance "jamais re-show" est
  // gérée côté compte via profiles.first_scan_celebrated_at (cf l'effet de
  // détection + markFirstScanCelebrated).
  const [celebrateFirstScan, setCelebrateFirstScan] = useState(false);
  // Ref pour détecter la transition 0→1+ sans piège de state update.
  const prevProcessedCountRef = useRef<number>(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ─── Camera UX : caméra intégrée (getUserMedia) ───
  // openCamera ouvre désormais le composant CameraCapture plutôt que de
  // cliquer un <input capture> (qui échoue en silence sur certains Android /
  // PWA). launchNativeCamera et l'input fichier restent comme fallback
  // (déclenchés depuis le composant si la caméra est indisponible).
  const openCamera = () => setCameraOpen(true);
  const launchNativeCamera = () => {
    setCameraGuideOpen(false);
    if (typeof window !== "undefined") localStorage.setItem(CAMERA_GUIDE_SEEN_KEY, "1");
    cameraInputRef.current?.click();
  };
  const openGallery = () => galleryInputRef.current?.click();
  /** Photo capturée par la caméra intégrée → même flux que l'import (stack). */
  const addCapturedFile = async (file: File) => {
    setCameraOpen(false);
    const item = await addToStack(file);
    setStack((prev) => [...prev, item]);
  };
  const dismissOnboarding = () => {
    setShowOnboarding(false);
    // Persistance côté compte (migration 027) — l'onboarding ne réapparaîtra
    // plus sur un autre appareil / après vidage du cache. Optimiste : on met à
    // jour founderInfo localement pour que l'effet de décision ne re-déclenche pas.
    void markOnboardingSeen();
    setFounderInfo((prev) =>
      prev ? { ...prev, onboardingSeenAt: new Date().toISOString() } : prev,
    );
  };
  const dismissTrial = () => {
    localStorage.setItem("yield_trial_dismissed", "1");
    setShowTrial(false);
  };

  // ─── API helper : attache systématiquement le Bearer JWT ───
  const callApi = async (path: string, init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/"); throw new Error("No session"); }
    return fetch(path, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${session.access_token}` },
    });
  };

  const startCheckout = async () => {
    setCheckoutLoading(true);
    setBillingError(null);
    try {
      const res = await callApi("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Erreur ${res.status}`);
      if (!data.url) throw new Error("Réponse Stripe invalide (pas d'URL).");
      window.location.href = data.url;
    } catch (err) {
      setBillingError(`Impossible d'ouvrir le paiement : ${err instanceof Error ? err.message : "Paiement indisponible."}`);
      setCheckoutLoading(false);
    }
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    setBillingError(null);
    try {
      const res = await callApi("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Erreur ${res.status}`);
      if (!data.url) throw new Error("Portail Stripe indisponible.");
      window.location.href = data.url;
    } catch (err) {
      setBillingError(`Impossible d'ouvrir le portail : ${err instanceof Error ? err.message : "Portail indisponible."}`);
      setPortalLoading(false);
    }
  };

  const exportCSV = async () => {
    setExportLoading(true);
    try {
      // Token HMAC court (5 min, scopé null = export global) via /api/exports/sign.
      await openSignedExport("/api/exports/csv", null);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Échec de l'export");
    } finally {
      setTimeout(() => setExportLoading(false), 800);
    }
  };

  /**
   * Persiste le nom du restaurant : profiles.restaurant_name (toujours) +
   * restaurants.name si la ligne existe déjà. Si pas encore créée (1er scan
   * pas encore fait), le lazy-create dans /api/invoices/process la créera
   * avec ce nom (lit profiles.restaurant_name).
   */
  const onSubmitRestaurantName = async (name: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Session expirée");
    const uid = session.user.id;
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ restaurant_name: name })
      .eq("id", uid);
    if (pErr) throw new Error(pErr.message);

    const { data: existing } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", uid)
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { error: rErr } = await supabase
        .from("restaurants")
        .update({ name })
        .eq("id", (existing as { id: string }).id);
      if (rErr) throw new Error(rErr.message);
    }
    setRestaurantName(name);
  };

  const refreshSubscription = async (uid: string): Promise<boolean> => {
    const { data } = await supabase.from("profiles").select("is_subscribed").eq("id", uid).maybeSingle();
    const subscribed = Boolean((data as { is_subscribed?: boolean } | null)?.is_subscribed);
    setIsSubscribed(subscribed);
    if (subscribed) { setShowTrial(false); setPaymentRequired(false); setBillingError(null); }
    return subscribed;
  };

  // ─── Data loaders : délèguent à _lib/dashboard-data, wrappent setState ───
  const reloadUsage = async () => setUsage(await fetchUsage(QUOTA));
  const reloadInvoices = async () => {
    const next = await fetchInvoices();
    setInvoices((prev) => (invoicesChanged(prev, next) ? next : prev));
    setInvoicesLoaded(true);
  };
  const reloadAlerts = async () => setAlerts(await fetchAlerts());
  const reloadMonthlyStats = async () => setMonthlyStats(await fetchMonthlyStats());
  const reloadRecipesStats = async () => setRecipesStats(await fetchRecipesHealth());
  const reloadRecentScans = async () => setRecentScans(await fetchRecentScansCount(7));
  /** Charge les infos fondateur. Si l'user n'a pas encore de referralCode
   *  (webhook signup raté pour lui), on déclenche un self-heal via la RPC
   *  ensure_founder_metadata puis on refetch. Évite que le filleul tape un
   *  code parrain qui pointe vers un parrain au profile non encore initialisé. */
  const reloadFounderInfo = async () => {
    const info = await fetchFounderInfo();
    if (info && info.referralCode == null) {
      const healed = await ensureFounderMetadata();
      if (healed) {
        const fresh = await fetchFounderInfo();
        setFounderInfo(fresh);
        return;
      }
    }
    setFounderInfo(info);
  };

  /** Marque la lettre de Lucas comme lue et ferme le modal. Optimistic update :
   *  on patche le state local immédiatement pour que le modal disparaisse,
   *  puis on persiste en arrière-plan. Échec persistance = on re-affichera au
   *  prochain login (acceptable). */
  const dismissFounderLetter = () => {
    setFounderInfo((prev) =>
      prev ? { ...prev, founderLetterSeenAt: new Date().toISOString() } : prev,
    );
    void markFounderLetterSeen();
  };

  // Ouvre la calculatrice pré-remplie avec les lignes d'une facture donnée.
  // Trigger raccourci "Créer une recette depuis cette facture".
  const createRecipeFromInvoice = async (invoiceId: string) => {
    const lines = await fetchInvoiceLinesForCalc(invoiceId);
    if (lines.length === 0) {
      setCalcSeed(null);
    } else {
      setCalcSeed(lines.map<CalculatorInitialIngredient>((l) => ({
        productId: l.productId ?? undefined,
        name: l.name,
        unit: l.unit,
        pricePerUnitHt: l.pricePerUnitHt,
        quantity: l.quantity,
        quantityUnit: l.quantityUnit,
      })));
    }
    setCalcOpen(true);
  };

  // ─── Mutations (UI optimiste, rollback si fail) ────────────
  const dismissAlert = async (alertId: string) => {
    const previous = alerts;
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    if (!(await markAlertRead(alertId))) setAlerts(previous);
  };
  /** Clic sur une alerte dans le drawer cloche : marque lue (UI optimiste)
   *  + redirige vers la facture qui l'a déclenchée. */
  const onAlertClick = (invoiceId: string, alertId: string) => {
    void dismissAlert(alertId);
    router.push(`/dashboard/invoices/${invoiceId}`);
  };
  const dismissInvoice = async (invoiceId: string) => {
    const previous = invoices;
    setInvoices((prev) => prev.filter((i) => i.id !== invoiceId));
    if (!(await deleteInvoice(invoiceId))) {
      setInvoices(previous);
      return;
    }
    // Suppression réussie → le total mensuel doit être recalculé.
    void reloadMonthlyStats();
  };

  // ─── Stack (IDB persistant) ────────────────────────────────
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: StackItem[] = [];
    for (const file of Array.from(files)) added.push(await addToStack(file));
    setStack((prev) => [...prev, ...added]);
  };
  const removeStackItem = async (id: string) => {
    await removeFromStack(id);
    setStack((prev) => prev.filter((s) => s.id !== id));
  };
  const clearStackAll = async () => { await clearStack(); setStack([]); };

  // ─── Lot de scans : effets de bord page-spécifiques injectés dans le store ──
  // La boucle processBatch et l'état des cartes vivent dans batch-store (hors
  // React → survit à la navigation). La page n'y branche que ses effets de bord
  // (compteur quota, upsell, checkout, reload des données). Ré-enregistrés à
  // chaque rendu pour capturer des closures fraîches ; remis à {} au démontage
  // du dashboard (les effets sont alors ignorés, mais le traitement continue).
  useEffect(() => {
    setBatchHandlers({
      onItemSuccess: (scansUsed) => {
        if (typeof scansUsed === "number") {
          setUsage((u) => (u ? { ...u, used: scansUsed } : { used: scansUsed, quota: QUOTA }));
        }
      },
      onQuotaExceeded: () => {
        setQuotaExceeded(true);
        setUsage((u) => (u ? { ...u, used: u.quota } : { used: QUOTA, quota: QUOTA }));
      },
      onPaymentRequired: () => {
        setShowTrial(true);
        setPaymentRequired(true);
        setTimeout(() => { void startCheckout(); }, 600);
      },
      onBatchFinished: () => {
        void reloadInvoices();
        void reloadAlerts();
        void reloadMonthlyStats();
        void reloadRecipesStats();
        void reloadRecentScans();
      },
      onSessionLost: () => router.replace("/"),
    });
    return () => setBatchHandlers({});
  });

  const sendStack = () => {
    // Garde anti double-envoi + stack vide (le store reverrouille en interne).
    if (batchRunning || stack.length === 0) return;
    const queued = stack.map<BatchInput>((s) => ({ id: s.id, fileName: s.fileName, status: "queued", file: s.file }));
    // On vide le stack TOUT DE SUITE : la barre du bas disparaît et il devient
    // impossible de re-cliquer "Envoyer" (le lot est parti). Le suivi se fait
    // via les cartes provisoires inline (queued → uploading → processing → vraie
    // carte facture), et les échecs restent en carte rouge "Réessayer".
    setStack([]);
    void clearStack();
    startBatch(queued);
  };

  // ─── Décision onboarding : pilotée par le serveur (profiles.onboarding_seen_at) ──
  // Remplace l'ancien flag localStorage qui réapparaissait sur un autre
  // appareil. On attend que founderInfo ET la liste des factures soient
  // chargés pour décider sans flash.
  useEffect(() => {
    if (!founderInfo || !invoicesLoaded) return;
    if (founderInfo.onboardingSeenAt != null) return; // déjà vu (persisté compte)
    // Filet de sécurité : compte déjà actif (a des factures) mais flag absent
    // — typiquement un compte pré-migration 027 non couvert par le backfill.
    // On considère l'onboarding fait et on soigne le compte côté serveur.
    if (invoices.length > 0) {
      setShowOnboarding(false);
      void markOnboardingSeen();
      setFounderInfo((prev) =>
        prev ? { ...prev, onboardingSeenAt: new Date().toISOString() } : prev,
      );
      return;
    }
    setShowOnboarding(true);
  }, [founderInfo, invoicesLoaded, invoices.length]);

  // ─── Détection 1er scan : transition 0 → ≥1 facture processed ──
  // Gating serveur (profiles.first_scan_celebrated_at) : la célébration ne se
  // montre qu'une seule fois à vie, sur n'importe quel appareil. On persiste
  // dès le déclenchement pour qu'un reload pendant les 6s ne la re-joue pas.
  useEffect(() => {
    if (!founderInfo) return; // on attend de connaître l'état serveur
    const processedCount = invoices.filter((i) => i.status === "processed").length;
    if (founderInfo.firstScanCelebratedAt != null) {
      // Déjà fêté → on synchronise le ref pour qu'une future transition (re-scan
      // après suppression, etc.) ne re-déclenche pas.
      prevProcessedCountRef.current = processedCount;
      return;
    }
    if (prevProcessedCountRef.current === 0 && processedCount >= 1) {
      setCelebrateFirstScan(true);
      void markFirstScanCelebrated();
      setFounderInfo((prev) =>
        prev ? { ...prev, firstScanCelebratedAt: new Date().toISOString() } : prev,
      );
    }
    prevProcessedCountRef.current = processedCount;
  }, [invoices, founderInfo]);

  // ─── Bootstrap : session, data, onboarding, retour Stripe ──
  useEffect(() => {
    void listStack().then(setStack);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/"); return; }
      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      setLoading(false);
      void reloadUsage(); void reloadInvoices(); void reloadAlerts();
      void reloadMonthlyStats(); void reloadRecipesStats(); void reloadRecentScans();
      void reloadFounderInfo();

      // Application du code parrain si présent dans localStorage (set par la
      // home quand l'URL contient ?ref=CODE). La RPC apply_referral_code est
      // idempotente + atomique côté Postgres : on peut la déclencher sans
      // crainte. On clear le localStorage dès qu'on a une réponse (ok ou error
      // définitive) pour ne pas re-tenter en boucle.
      if (typeof window !== "undefined") {
        const pendingRef = localStorage.getItem("yield_pending_referral_code");
        if (pendingRef) {
          void applyReferralCode(pendingRef).then((res) => {
            // Codes "définitifs" → on clear, ça ne re-deviendra jamais valide.
            // "unknown" / "not_authenticated" → on retry au prochain mount.
            // "rpc_missing" → migration en retard, on retry au prochain mount.
            const isFinal =
              res.ok ||
              res.error === "invalid_code" ||
              res.error === "self_referral" ||
              res.error === "duplicate_account" ||
              res.error === "already_subscribed";
            if (isFinal) {
              localStorage.removeItem("yield_pending_referral_code");
            }
            if (res.ok && !res.alreadyApplied && res.daysCredited) {
              setReferralJustApplied(res.daysCredited);
              // Re-fetch pour rafraîchir le badge fondateur + count filleuls
              void reloadFounderInfo();
            }
          });
        }
      }

      // Pré-remplit la modal onboarding si le nom est déjà connu (réouverture
      // manuelle après reset de onboarding_seen_at, ou bug de navigation).
      void supabase.from("profiles").select("restaurant_name").eq("id", session.user.id).maybeSingle()
        .then(({ data }) => {
          const n = (data as { restaurant_name?: string } | null)?.restaurant_name?.trim();
          if (n) setRestaurantName(n);
        });

      const subscribed = await refreshSubscription(session.user.id);
      if (typeof window === "undefined") return;
      // NB : la décision d'afficher l'onboarding est pilotée par un effet
      // dédié basé sur profiles.onboarding_seen_at (cf plus bas), plus sur
      // localStorage — pour ne pas réapparaître sur un autre appareil.

      const params = new URLSearchParams(window.location.search);
      const cameFromCheckout = params.get("checkout") === "success";
      const dismissed = localStorage.getItem("yield_trial_dismissed") === "1";

      if (cameFromCheckout) {
        window.history.replaceState({}, "", "/dashboard");
        if (subscribed) {
          setSubscriptionActivated(true);
          setTimeout(() => setSubscriptionActivated(false), 4000);
        } else {
          setStripePollActive(true);
        }
      } else {
        setShowTrial(!subscribed && !dismissed);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling Stripe post-checkout (jusqu'à 25s)
  useStripeActivationPolling({
    active: stripePollActive,
    userId,
    refreshSubscription,
    onActivating: setActivatingSubscription,
    onActivated: () => {
      setStripePollActive(false);
      setSubscriptionActivated(true);
      setTimeout(() => setSubscriptionActivated(false), 4000);
    },
    onTimeout: () => {
      setStripePollActive(false);
      setBillingError(
        "Activation en attente. Le paiement est validé chez Stripe mais le webhook n'a pas encore mis à jour votre profil. Cliquez sur Rafraîchir ci-dessous, ou attendez 30s puis recharger la page.",
      );
    },
  });

  // Polling factures tant qu'au moins une est en processing, OU tant qu'un lot
  // tourne (pour que les vraies cartes facture apparaissent au fil de l'analyse
  // et remplacent les cartes provisoires, même avant le premier reload).
  const hasProcessing = invoices.some((i) => i.status === "processing" || i.status === "pending");
  useInvoicesPolling(batchRunning || hasProcessing, () => { void reloadInvoices(); });

  // Dès qu'un item du lot aboutit, on recharge la timeline sans attendre le
  // prochain tick : la vraie carte facture (montant + variation) prend aussitôt
  // la place de la carte provisoire `done`.
  const batchDoneCount = batchItems.filter((i) => i.status === "done").length;
  useEffect(() => {
    if (batchDoneCount > 0) void reloadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchDoneCount]);

  // ─── Dérivés pour le rendu ─────────────────────────────────
  const unreadCount = alerts.filter((a) => !a.is_read).length;
  // Cartes provisoires en attente d'affichage (tout sauf `done`, qui est repris
  // par la vraie carte facture). Sert à afficher la timeline même sur un tout
  // premier scan (aucune facture DB encore).
  const hasProvisionalCards = batchItems.some((i) => i.status !== "done");

  /** Nom d'accueil intelligent : priorité au nom du restaurant (saisi à
   *  l'onboarding), fallback "Chef". On évite délibérément le préfixe
   *  d'email qui produit des greetings moches ("Bonjour, lucasyieldapp"). */
  const displayName = restaurantName.trim() || "Chef";

  /** Statut essai parrainé : si l'user a un trial_extra_days > 0 et n'est
   *  pas encore abonné, on affiche le ReferralTrialBanner (30j Starter Pro)
   *  à la place du TrialBanner classique 14j. Évite de pousser une offre
   *  obsolète à un user qui a déjà un bonus actif. */
  const trialStatus = founderInfo
    ? computeTrialDaysLeft(founderInfo.createdAt, founderInfo.trialExtraDays)
    : null;
  const isReferredTrialActive =
    !isSubscribed
    && trialStatus != null
    && trialStatus.isReferred
    && trialStatus.daysLeft > 0;

  /** Salutation time-aware : "Bonjour" le matin, "Bon service" en pleine
   *  journée, "Bonsoir" en soirée. Reflète mieux le rythme d'un chef qui
   *  ouvre Yield à différents moments (livraisons matin, contrôle service). */
  const hour = new Date().getHours();
  const timeGreeting = hour < 11 ? "Bonjour" : hour < 18 ? "Bon service" : "Bonsoir";

  /** Date du 1er scan processed — sert à la période de grâce du
   *  ScanReminderBanner (pas de reproche aux nouveaux comptes). Dérivé
   *  de la liste des factures déjà en state, pas de requête additionnelle. */
  const firstScanAt = useMemo<Date | null>(() => {
    const processed = invoices.filter((i) => i.status === "processed");
    if (processed.length === 0) return null;
    // invoices est trié desc par created_at, le dernier element a la date
    // la plus ancienne. On parse invoice_date (fallback created_at via le
    // mapping fetchInvoices déjà fait).
    const dates = processed
      .map((i) => new Date(i.invoice_date).getTime())
      .filter((t) => Number.isFinite(t));
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates));
  }, [invoices]);
  const refreshBilling = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    if (await refreshSubscription(session.user.id)) {
      setBillingError(null);
      setSubscriptionActivated(true);
      setTimeout(() => setSubscriptionActivated(false), 4000);
    }
  };

  return (
    <div className="min-h-screen pb-28" style={{ background: "#F7F9FF" }}>
      <DashboardHeader
        invoicesCount={invoices.length}
        exportLoading={exportLoading} onExportCsv={exportCSV}
        isSubscribed={isSubscribed}
        portalLoading={portalLoading} onOpenPortal={openBillingPortal}
        usage={usage} onQuotaClick={() => setQuotaExceeded(true)}
        alerts={alerts} onAlertClick={onAlertClick}
        onOpenCalculator={() => setCalcOpen(true)}
      />

      <div className="max-w-lg mx-auto px-5 pt-6 space-y-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">
              {timeGreeting}, {displayName} 👋
            </h1>
            {/* Badge "Membre #007" — petite touche d'appartenance quotidienne.
                Caché si founder_number pas encore assigné (compte pré-migration
                ou webhook signup en retard). */}
            {founderInfo?.founderNumber != null && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-sm"
                title="Vous êtes un membre fondateur de Yield."
              >
                Membre #{String(founderInfo.founderNumber).padStart(3, "0")}
              </span>
            )}
          </div>
          {/* Sous-titre neutre — les chiffres précis (alertes, factures) sont
              déjà visibles dans MonthlyStatsStrip + cloche + Hero. On évite
              de répéter la même info à 4 endroits. */}
          <p className="text-slate-400 text-sm">
            {invoices.length === 0
              ? "Scannez votre premier bon de livraison pour démarrer."
              : unreadCount > 0
                ? `${unreadCount} alerte${unreadCount > 1 ? "s" : ""} à examiner.`
                : "Tour d'horizon de votre cuisine."}
          </p>
        </motion.div>

        <ActivatingBanner show={activatingSubscription} />
        <ActivatedBanner show={subscriptionActivated} />
        <PaymentRequiredBanner show={paymentRequired} loading={checkoutLoading} onCheckout={startCheckout} />
        {!paymentRequired && (
          isReferredTrialActive && trialStatus ? (
            // Essai parrainé Starter Pro 30j : on remplace l'offre 14j par
            // un bandeau qui confirme le statut + compteur jours restants.
            <ReferralTrialBanner
              show={showTrial}
              daysLeft={trialStatus.daysLeft}
              totalDays={trialStatus.totalDays}
              onSubscribe={startCheckout}
              onDismiss={dismissTrial}
              loading={checkoutLoading}
            />
          ) : (
            <TrialBanner show={showTrial} loading={checkoutLoading} onStart={startCheckout} onDismiss={dismissTrial} />
          )
        )}
        <BillingErrorBanner message={billingError} onRefresh={refreshBilling} onDismiss={() => setBillingError(null)} />

        {/* Hero — action-first : on remonte les CTAs scan/recettes AVANT
            les KPIs passifs. L'objectif est qu'un chef pressé voit d'abord
            "que peut-il faire" puis "où il en est". */}
        <DashboardHero
          onScan={openCamera}
          onCreateRecipe={() => { setCalcSeed(null); setCalcOpen(true); }}
          recipesCount={recipesStats?.total ?? 0}
        />

        {/* Rappel scan — nudge doux si le chef a oublié de scanner cette
            semaine. Le composant gère lui-même le dismiss localStorage (3j). */}
        {!reminderDismissed && recentScans != null && (
          <ScanReminderBanner
            recentScans={recentScans}
            totalInvoices={invoices.length}
            firstScanAt={firstScanAt}
            onDismiss={() => setReminderDismissed(true)}
          />
        )}

        {/* Empty state additionnel : si aucune facture, on offre l'option
            "Importer un fichier" en lien discret. L'option scan est déjà
            portée par DashboardHero Card A — pas de gros bouton redondant.
            Masqué pendant un lot (les cartes provisoires occupent déjà l'espace). */}
        {invoices.length === 0 && !hasProvisionalCards && (
          <motion.button
            onClick={openGallery}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full py-2.5 rounded-xl border border-dashed border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/30 text-sm flex items-center justify-center gap-1.5 transition-colors"
          >
            <FolderOpen size={14} />
            Importer un fichier existant (ancienne facture)
          </motion.button>
        )}

        {/* KPIs synthétiques du mois — caché tant qu'aucune facture processed.
            Position après le Hero : info passive en seconde lecture. */}
        <MonthlyStatsStrip stats={monthlyStats} alertsCount={alerts.length} />

        {/* Widget Santé de votre Carte — caché tant qu'aucune recette n'est
            enregistrée. Détail concret après les KPIs synthétiques. */}
        <CardHealthWidget />

        {/* Les alertes de prix vivent désormais dans la cloche du header
            (NotificationsBell). La timeline ne contient plus que des
            InvoiceCard pour un dashboard ultra-pro et épuré. */}

        {(invoices.length > 0 || hasProvisionalCards) && (
          <InvoicesList
            invoices={invoices} filter={invoiceFilter} onFilterChange={setInvoiceFilter}
            onOpenCamera={openCamera} onOpenGallery={openGallery}
            onInvoiceClick={(id) => router.push(`/dashboard/invoices/${id}`)}
            onInvoiceDismiss={dismissInvoice}
            onCreateRecipeFromInvoice={(id) => { void createRecipeFromInvoice(id); }}
            provisional={batchItems}
            onRetryProvisional={retryItem}
            onDismissProvisional={dismissItem}
          />
        )}

        {/* Carte de réassurance "tout va bien" — affichée seulement si tout
            est sain : factures + 0 alerte + recettes pas critiques. */}
        {!loading && alerts.length === 0 && invoices.length > 0 && (recipesStats?.critical ?? 0) === 0 && (
          <div className="card rounded-2xl p-6 text-center">
            <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-slate-900 font-semibold mb-1">Marges saines.</p>
            <p className="text-slate-400 text-sm">Aucune dérive matière détectée. Votre food cost est stable.</p>
          </div>
        )}

        {/* Footer mini : liens légaux discrets, exigés par Stripe + RGPD. */}
        <footer className="pt-6 pb-2 text-center text-[11px] text-slate-300">
          <a href="/terms" className="hover:text-slate-500 mx-2">CGU</a>
          ·
          <a href="/privacy" className="hover:text-slate-500 mx-2">Confidentialité</a>
        </footer>
      </div>

      {/* Inputs file cachés (sr-only) — fallback "Importer" / sélecteur de
          fichiers. Le scan principal passe désormais par la caméra intégrée
          (<CameraCapture>, getUserMedia) car <input capture> échoue en silence
          sur certains Android / PWA. galleryInputRef sert à l'import (et au
          fallback "Importer une photo" depuis la caméra). cameraInputRef reste
          déclenché par le guide caméra legacy (fallback). */}
      <input
        ref={cameraInputRef} type="file" multiple className="sr-only"
        accept="image/*"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={galleryInputRef} type="file" multiple className="sr-only"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      <ScannerFAB onClick={openCamera} show={invoices.length > 0 && stack.length === 0} />
      <CameraGuide open={cameraGuideOpen} onConfirm={launchNativeCamera} onCancel={() => setCameraGuideOpen(false)} />
      {/* Caméra intégrée (getUserMedia) — flux de scan principal. Fallback vers
          le sélecteur de fichiers (openGallery) si la caméra est refusée/indispo. */}
      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          // Observabilité : on ne laisse plus la rejection être avalée par `void`
          // (sinon un échec d'ajout au stack disparaît en silence).
          addCapturedFile(file).catch((err) => {
            console.error("[scan] addCapturedFile failed", err);
            captureException(err, {
              tags: { feature: "scan-camera" },
              extra: { fileName: file.name },
            });
          });
        }}
        onPickFile={() => { setCameraOpen(false); openGallery(); }}
      />
      <AnimatePresence>
        {stack.length > 0 && (
          <StackTray
            items={stack}
            onSend={sendStack} onRemove={removeStackItem} onClearAll={clearStackAll}
            onAddMore={openCamera} onShowGuide={() => setCameraGuideOpen(true)}
            busy={batchRunning}
          />
        )}
      </AnimatePresence>
      <QuotaExceededModal open={quotaExceeded} quota={QUOTA} onClose={() => setQuotaExceeded(false)} />
      <ConciergeButton />
      <OnboardingModal
        show={showOnboarding}
        onClose={dismissOnboarding}
        onStart={() => { dismissOnboarding(); openCamera(); }}
        onOpenCalculator={() => setCalcOpen(true)}
        onSubmitName={onSubmitRestaurantName}
        initialName={restaurantName}
      />
      <FlashCalculator
        open={calcOpen}
        onClose={() => { setCalcOpen(false); setCalcSeed(null); }}
        initialIngredients={calcSeed ?? undefined}
      />
      <FirstScanCelebration
        show={celebrateFirstScan}
        onDismiss={() => setCelebrateFirstScan(false)}
      />
      {/* Lettre Lucas — affichée seulement si jamais vue (founder_letter_seen_at
          null). founderInfo est null pendant le 1er fetch → modale cachée par
          défaut, évite le flash si l'user l'a déjà vue. */}
      <FounderLetter
        show={founderInfo != null && founderInfo.founderLetterSeenAt == null}
        founderNumber={founderInfo?.founderNumber ?? null}
        onClose={dismissFounderLetter}
      />
      {/* Easter egg ciblé — voir EasterEggModal.tsx (cible: 1 email précis,
          one-shot via localStorage, à retirer en supprimant ces 2 lignes +
          l'import + le fichier _components/EasterEggModal.tsx). */}
      <EasterEggModal userEmail={userEmail} />
      {/* Toast bonus parrainage — apparaît immédiatement après l'application
          réussie de la RPC, par-dessus la lettre Lucas si concurrent. */}
      <ReferralAppliedToast
        daysCredited={referralJustApplied}
        onDismiss={() => setReferralJustApplied(null)}
      />
    </div>
  );
}
