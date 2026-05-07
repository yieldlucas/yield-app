"use client";

// Dashboard chef — orchestration top-level. Le JSX et la logique métier
// vivent dans /_components, /_hooks, /_lib pour rester compact ici.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { addToStack, listStack, removeFromStack, clearStack, type StackItem } from "@/lib/scan-stack";
import { openSignedExport } from "@/lib/export-download";

import { ScannerFAB } from "./_components/ScannerFAB";
import { CameraGuide } from "./_components/CameraGuide";
import { StackTray } from "./_components/StackTray";
import { TrialBanner } from "./_components/TrialBanner";
import { OnboardingModal } from "./_components/OnboardingModal";
import { ConciergeButton } from "./_components/ConciergeButton";
import { BatchOverlay } from "./_components/BatchOverlay";
import { QuotaExceededModal } from "./_components/QuotaExceededModal";
import { InvoicesList, type InvoiceFilter } from "./_components/InvoicesList";
import { DashboardHeader } from "./_components/DashboardHeader";
import { EmptyScanCTA } from "./_components/EmptyScanCTA";
import { MonthlyStatsStrip } from "./_components/MonthlyStatsStrip";
import {
  ActivatingBanner, ActivatedBanner, PaymentRequiredBanner, BillingErrorBanner,
} from "./_components/SubscriptionBanners";
import { type Alert, type RecentInvoice, type BatchItem } from "./_components/types";
import { useStripeActivationPolling } from "./_hooks/useStripeActivationPolling";
import { useInvoicesPolling } from "./_hooks/useInvoicesPolling";
import {
  fetchUsage, fetchInvoices, invoicesChanged, fetchAlerts,
  markAlertRead, deleteInvoice, fetchMonthlyStats, type MonthlyStats,
} from "./_lib/dashboard-data";
import { processBatch, type BatchInput } from "./_lib/process-batch";

const QUOTA = 200;
const CAMERA_GUIDE_SEEN_KEY = "yield_camera_guide_seen";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [invoices, setInvoices] = useState<RecentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [cameraGuideOpen, setCameraGuideOpen] = useState(false);
  const [stack, setStack] = useState<StackItem[]>([]);
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>("all");
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  // Pré-remplit la modal d'onboarding si le user a déjà saisi son nom
  // (re-onboarding manuel via /profile, ou ré-affichage forcé).
  const [restaurantName, setRestaurantName] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ─── Camera UX : guide à la 1ère utilisation, ouverture directe ensuite ───
  const openCamera = () => {
    if (typeof window !== "undefined" && localStorage.getItem(CAMERA_GUIDE_SEEN_KEY) === "1") {
      cameraInputRef.current?.click();
      return;
    }
    setCameraGuideOpen(true);
  };
  const launchNativeCamera = () => {
    setCameraGuideOpen(false);
    if (typeof window !== "undefined") localStorage.setItem(CAMERA_GUIDE_SEEN_KEY, "1");
    cameraInputRef.current?.click();
  };
  const openGallery = () => galleryInputRef.current?.click();
  const dismissOnboarding = () => {
    localStorage.setItem("yield_onboarding_seen", "1");
    setShowOnboarding(false);
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
      await openSignedExport("/api/export/csv", null);
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
  };
  const reloadAlerts = async () => setAlerts(await fetchAlerts());
  const reloadMonthlyStats = async () => setMonthlyStats(await fetchMonthlyStats());

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

  /** Lance un lot. La logique d'orchestration (callbacks) vit dans _lib/process-batch. */
  const runBatch = (input: BatchInput[]) =>
    processBatch(input, {
      updateItem: (id, patch) => setBatch((b) => b.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      cancelQueued: (reason) =>
        setBatch((b) => b.map((x) => (x.status === "queued" ? { ...x, status: "error", error: reason } : x))),
      onItemSuccess: async (id, scansUsed) => {
        if (typeof scansUsed === "number") {
          setUsage((u) => (u ? { ...u, used: scansUsed } : { used: scansUsed, quota: QUOTA }));
        }
        await removeFromStack(id);
        setStack((prev) => prev.filter((s) => s.id !== id));
      },
      onSessionLost: () => router.replace("/"),
      onQuotaExceeded: () => {
        setBatchOpen(false);
        setQuotaExceeded(true);
        setUsage((u) => (u ? { ...u, used: u.quota } : { used: QUOTA, quota: QUOTA }));
      },
      onPaymentRequired: () => {
        setBatchOpen(false);
        setShowTrial(true);
        setPaymentRequired(true);
        setTimeout(() => { void startCheckout(); }, 600);
      },
      onBatchFinished: () => {
        void reloadInvoices();
        void reloadAlerts();
        void reloadMonthlyStats();
      },
    });

  const sendStack = () => {
    if (stack.length === 0) return;
    const queued = stack.map<BatchInput>((s) => ({ id: s.id, fileName: s.fileName, status: "queued", file: s.file }));
    setBatch(queued);
    setBatchOpen(true);
    void runBatch(queued);
  };
  const retryErrored = () => {
    const erroredIds = new Set(batch.filter((i) => i.status === "error").map((i) => i.id));
    const toRetry = stack.filter((s) => erroredIds.has(s.id));
    if (toRetry.length === 0) return;
    const queued = toRetry.map<BatchInput>((s) => ({ id: s.id, fileName: s.fileName, status: "queued", file: s.file }));
    setBatchOpen(false);
    setBatch(queued);
    setBatchOpen(true);
    void runBatch(queued);
  };

  // ─── Bootstrap : session, data, onboarding, retour Stripe ──
  useEffect(() => {
    void listStack().then(setStack);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/"); return; }
      setUser({ email: session.user.email ?? "" });
      setUserId(session.user.id);
      setLoading(false);
      void reloadUsage(); void reloadInvoices(); void reloadAlerts(); void reloadMonthlyStats();

      // Pré-remplit la modal onboarding si le nom est déjà connu (réouverture
      // manuelle après reset de yield_onboarding_seen, ou bug de navigation).
      void supabase.from("profiles").select("restaurant_name").eq("id", session.user.id).maybeSingle()
        .then(({ data }) => {
          const n = (data as { restaurant_name?: string } | null)?.restaurant_name?.trim();
          if (n) setRestaurantName(n);
        });

      const subscribed = await refreshSubscription(session.user.id);
      if (typeof window === "undefined") return;
      if (!localStorage.getItem("yield_onboarding_seen")) setShowOnboarding(true);

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

  // Polling factures tant qu'au moins une est en processing
  const hasProcessing = invoices.some((i) => i.status === "processing" || i.status === "pending");
  useInvoicesPolling(hasProcessing, () => { void reloadInvoices(); });

  // ─── Dérivés pour le rendu ─────────────────────────────────
  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const firstName = user?.email?.split("@")[0] ?? "";
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
      />

      <div className="max-w-lg mx-auto px-5 pt-6 space-y-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-slate-900 mb-0.5">
            Bonjour{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-slate-400 text-sm">
            {alerts.length > 0
              ? `${unreadCount} alerte${unreadCount > 1 ? "s" : ""} à examiner ce matin`
              : invoices.length > 0
                ? "Votre rendement est stable aujourd'hui"
                : "Scannez votre premier bon de livraison pour démarrer"}
          </p>
        </motion.div>

        <ActivatingBanner show={activatingSubscription} />
        <ActivatedBanner show={subscriptionActivated} />
        <PaymentRequiredBanner show={paymentRequired} loading={checkoutLoading} onCheckout={startCheckout} />
        {!paymentRequired && (
          <TrialBanner show={showTrial} loading={checkoutLoading} onStart={startCheckout} onDismiss={dismissTrial} />
        )}
        <BillingErrorBanner message={billingError} onRefresh={refreshBilling} onDismiss={() => setBillingError(null)} />

        {/* KPIs synthétiques du mois — caché tant qu'aucune facture processed. */}
        <MonthlyStatsStrip stats={monthlyStats} alertsCount={alerts.length} />

        {invoices.length === 0 && <EmptyScanCTA onOpenCamera={openCamera} onOpenGallery={openGallery} />}

        {/* Les alertes de prix vivent désormais dans la cloche du header
            (NotificationsBell). La timeline ne contient plus que des
            InvoiceCard pour un dashboard ultra-pro et épuré. */}

        {invoices.length > 0 && (
          <InvoicesList
            invoices={invoices} filter={invoiceFilter} onFilterChange={setInvoiceFilter}
            onOpenCamera={openCamera} onOpenGallery={openGallery}
            onInvoiceClick={(id) => router.push(`/dashboard/invoices/${id}`)}
            onInvoiceDismiss={dismissInvoice}
          />
        )}

        {!loading && alerts.length === 0 && invoices.length > 0 && (
          <div className="card rounded-2xl p-6 text-center">
            <CheckCircle2 size={28} className="text-blue-500 mx-auto mb-3" />
            <p className="text-slate-900 font-semibold mb-1">Rendement nominal.</p>
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

      {/* Inputs file cachés — déclenchés par les FAB / CTA */}
      <input
        ref={cameraInputRef} type="file" multiple capture="environment" className="hidden"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={galleryInputRef} type="file" multiple className="hidden"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      <ScannerFAB onClick={openCamera} show={invoices.length > 0 && stack.length === 0} />
      <CameraGuide open={cameraGuideOpen} onConfirm={launchNativeCamera} onCancel={() => setCameraGuideOpen(false)} />
      <AnimatePresence>
        {stack.length > 0 && (
          <StackTray
            items={stack}
            onSend={sendStack} onRemove={removeStackItem} onClearAll={clearStackAll}
            onAddMore={launchNativeCamera} onShowGuide={() => setCameraGuideOpen(true)}
            busy={batchOpen && !batch.every((i) => i.status === "done" || i.status === "error")}
          />
        )}
      </AnimatePresence>
      <QuotaExceededModal open={quotaExceeded} quota={QUOTA} onClose={() => setQuotaExceeded(false)} onCheckout={startCheckout} />
      <ConciergeButton />
      <BatchOverlay
        items={batch} open={batchOpen}
        onClose={() => { setBatchOpen(false); setBatch([]); }}
        onRetake={retryErrored}
      />
      <OnboardingModal
        show={showOnboarding}
        onClose={dismissOnboarding}
        onStart={() => { dismissOnboarding(); openCamera(); }}
        onSubmitName={onSubmitRestaurantName}
        initialName={restaurantName}
      />
    </div>
  );
}
