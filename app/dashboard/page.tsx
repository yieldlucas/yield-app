"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Bell, TrendingDown, ChefHat, LogOut,
  CheckCircle2, AlertTriangle, FileText, ChevronRight,
  Sparkles, MessageCircle,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Alert {
  id: string;
  product_name: string;
  price_change_pct: number;
  old_price: number;
  new_price: number;
  affected_recipes: { name: string; margin_impact_pts: number }[];
  is_read: boolean;
  created_at: string;
}

interface RecentInvoice {
  id: string;
  supplier_name: string;
  invoice_date: string;
  status: "pending" | "processing" | "processed" | "error";
  items_count: number;
}

type UploadStatus = "idle" | "uploading" | "processing" | "done" | "error";

// ─── FAB Scanner ──────────────────────────────────────────
function ScannerFAB({ onClick, show }: { onClick: () => void; show: boolean }) {
  if (!show) return null;
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-5 z-30 btn-primary rounded-2xl flex items-center gap-3 px-5 py-4 shadow-blue-lg"
      aria-label="Scanner un bon de livraison"
    >
      <Camera size={22} className="text-white" />
      <span className="text-white font-bold text-sm">Scanner un BL</span>
    </motion.button>
  );
}

// ─── Conciergerie Chef ────────────────────────────────────
function ConciergeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 left-5 z-30 w-14 h-14 glass rounded-2xl flex items-center justify-center shadow-card border border-blue-100"
        aria-label="Conciergerie Chef"
      >
        <MessageCircle size={22} className="text-blue-600" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed bottom-24 left-5 z-30 w-72 glass rounded-2xl p-5 shadow-card border border-blue-100"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 btn-primary rounded-xl flex items-center justify-center">
                <ChefHat size={15} className="text-white" />
              </div>
              <div>
                <p className="text-slate-900 text-sm font-semibold">Conciergerie Chef</p>
                <div className="flex items-center gap-1 text-xs text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Disponible maintenant
                </div>
              </div>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              Un problème de scan ? Un doute sur un bon ? Notre équipe vous répond sous 2h.
            </p>
            <a
              href="mailto:chef@yield.restaurant"
              className="btn-primary w-full py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
            >
              <MessageCircle size={13} /> Contacter le concierge
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Upload overlay ───────────────────────────────────────
function UploadOverlay({ status, onClose, onRetake }: { status: UploadStatus; onClose: () => void; onRetake: () => void }) {
  const stages = [
    { key: "uploading", label: "Envoi du bon de livraison…" },
    { key: "processing", label: "Lecture des prix matière…" },
    { key: "done", label: "Bilan généré !" },
  ];
  const order = ["uploading", "processing", "done"];

  return (
    <AnimatePresence>
      {status !== "idle" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-center p-5">
          <motion.div initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} className="card rounded-3xl p-8 max-w-xs w-full text-center shadow-card">
            {status === "error" ? (
              <>
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={28} className="text-red-500" />
                </div>
                <h3 className="text-slate-900 font-bold text-lg mb-2">Lecture impossible</h3>
                <p className="text-slate-500 text-sm mb-6">
                  La photo est trop floue ou mal éclairée. Astuce : posez le bon à plat, évitez l&apos;ombre de votre main, et cadrez l&apos;intégralité du document.
                </p>
                <div className="space-y-2">
                  <button onClick={onRetake} className="btn-primary w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                    <Camera size={15} /> Reprendre la photo
                  </button>
                  <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition-colors">
                    Plus tard
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-2xl btn-primary flex items-center justify-center">
                    <ChefHat size={28} className="text-white" />
                  </div>
                  {status !== "done" && (
                    <svg className="absolute inset-0 animate-spin-slow" viewBox="0 0 64 64" fill="none">
                      <circle cx="32" cy="32" r="30" stroke="rgba(37,99,235,0.15)" strokeWidth="2" />
                      <path d="M32 2 A30 30 0 0 1 62 32" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>

                <div className="space-y-3 mb-5">
                  {stages.map(stage => {
                    const cur = order.indexOf(status);
                    const idx = order.indexOf(stage.key);
                    const isDone = idx < cur;
                    const isActive = idx === cur;
                    return (
                      <div key={stage.key} className={`flex items-center gap-3 text-sm transition-colors ${isActive ? "text-slate-900" : isDone ? "text-blue-600" : "text-slate-300"}`}>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${isActive ? "border-blue-500 bg-blue-50" : isDone ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
                          {isDone && <CheckCircle2 size={12} className="text-blue-500" />}
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                        </div>
                        {stage.label}
                      </div>
                    );
                  })}
                </div>

                {status === "done" && (
                  <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={onClose} className="btn-primary w-full py-3 rounded-xl text-sm">
                    Voir les résultats
                  </motion.button>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Alert card ───────────────────────────────────────────
function AlertCard({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false);
  const isHigh = Math.abs(alert.price_change_pct) >= 10;
  const priceDelta = alert.new_price - alert.old_price;
  const sign = priceDelta >= 0 ? "+" : "−";

  return (
    <motion.div layout onClick={() => setExpanded(v => !v)} className={`card rounded-2xl p-4 cursor-pointer card-hover border-l-4 ${isHigh ? "border-red-400" : "border-blue-400"}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isHigh ? "bg-red-50" : "bg-blue-50"}`}>
          <TrendingDown size={16} className={isHigh ? "text-red-500" : "text-blue-600"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-slate-800 font-semibold text-sm truncate">{alert.product_name}</p>
            <span className={`text-xs font-bold font-mono flex-shrink-0 px-2 py-0.5 rounded-lg ${isHigh ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-600"}`}>
              +{alert.price_change_pct.toFixed(1)}%
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {alert.old_price.toFixed(2)}€ → {alert.new_price.toFixed(2)}€
            <span className={`ml-1.5 font-mono font-semibold ${isHigh ? "text-red-500" : "text-blue-600"}`}>
              ({sign}{Math.abs(priceDelta).toFixed(2)}€/unité)
            </span>
          </p>
        </div>
        <ChevronRight size={16} className={`text-slate-300 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </div>

      <AnimatePresence>
        {expanded && alert.affected_recipes?.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                {alert.affected_recipes.length} fiche{alert.affected_recipes.length > 1 ? "s" : ""} à ajuster
              </p>
              {alert.affected_recipes.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{r.name}</span>
                  <span className={`font-mono font-semibold ${r.margin_impact_pts >= 2 ? "text-red-500" : "text-blue-600"}`}>
                    −{Math.abs(r.margin_impact_pts).toFixed(1)} pts de marge
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Onboarding modal ─────────────────────────────────────
function OnboardingModal({ show, onClose, onStart }: { show: boolean; onClose: () => void; onStart: () => void }) {
  const steps = [
    { n: "01", Icon: Camera, title: "Photographiez", desc: "Le bon de livraison, à réception, en 5 secondes." },
    { n: "02", Icon: Sparkles, title: "L'IA lit", desc: "Chaque ligne matière est extraite et comparée à vos historiques." },
    { n: "03", Icon: Bell, title: "Alerte rendement", desc: "Dès qu'une hausse dépasse 3%, YIELD vous prévient." },
  ];
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-center p-5"
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 16 }}
            className="card rounded-3xl p-8 max-w-sm w-full shadow-card"
          >
            <div className="w-14 h-14 btn-primary rounded-2xl flex items-center justify-center mx-auto mb-5 glow-blue-sm">
              <ChefHat size={26} className="text-white" />
            </div>
            <h2 className="text-slate-900 font-bold text-xl text-center mb-2">Bienvenue, chef</h2>
            <p className="text-slate-500 text-sm text-center mb-7 leading-relaxed">
              Scannez votre premier bon de livraison en 2 minutes. YIELD veille sur votre rendement.
            </p>
            <div className="space-y-4 mb-7">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-9 h-9 label-blue rounded-xl flex items-center justify-center flex-shrink-0">
                    <s.Icon size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-slate-300 font-mono text-xs font-bold">{s.n}</span>
                      <p className="text-slate-900 font-semibold text-sm">{s.title}</p>
                    </div>
                    <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onStart} className="btn-primary w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <Camera size={15} /> Scanner mon premier BL
            </button>
            <button onClick={onClose} className="w-full mt-2 py-2.5 text-sm text-slate-400 hover:text-slate-700 transition-colors">
              Plus tard
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Status badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: RecentInvoice["status"] }) {
  const map = {
    processed: "bg-blue-50 text-blue-600",
    processing: "bg-amber-50 text-amber-600",
    error: "bg-red-50 text-red-500",
    pending: "bg-slate-100 text-slate-500",
  };
  const labels = { processed: "Traitée", processing: "Analyse en cours", error: "Erreur", pending: "En attente" };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

// ─── Dashboard ────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [invoices, setInvoices] = useState<RecentInvoice[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openCamera = () => fileInputRef.current?.click();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/"); return; }
      setUser({ email: session.user.email ?? "" });
      loadMockData();
      if (typeof window !== "undefined" && !localStorage.getItem("yield_onboarding_seen")) {
        setShowOnboarding(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem("yield_onboarding_seen", "1");
    setShowOnboarding(false);
  };

  const loadMockData = () => {
    setLoading(false);
    setAlerts([
      {
        id: "1", product_name: "Filet de saumon",
        price_change_pct: 14.2, old_price: 16.20, new_price: 18.50,
        affected_recipes: [
          { name: "Tartare de saumon", margin_impact_pts: 3.2 },
          { name: "Pavé grillé purée", margin_impact_pts: 2.1 },
        ],
        is_read: false, created_at: new Date().toISOString(),
      },
      {
        id: "2", product_name: "Huile d'olive extra vierge",
        price_change_pct: 5.1, old_price: 27.50, new_price: 28.90,
        affected_recipes: [{ name: "Salade niçoise", margin_impact_pts: 0.9 }],
        is_read: false, created_at: new Date().toISOString(),
      },
    ]);
    setInvoices([
      { id: "1", supplier_name: "Metro Cash & Carry", invoice_date: "2026-04-22", status: "processed", items_count: 12 },
    ]);
  };

  const handleScan = async (file: File) => {
    setUploadStatus("uploading");
    const formData = new FormData();
    formData.append("invoice", file);
    try {
      await new Promise(r => setTimeout(r, 1000));
      setUploadStatus("processing");
      await new Promise(r => setTimeout(r, 2000));
      const res = await fetch("/api/invoices/process", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      setUploadStatus("done");
      loadMockData();
    } catch {
      setUploadStatus("error");
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const firstName = user?.email?.split("@")[0] ?? "";
  const totalRecipesAffected = alerts.reduce((sum, a) => sum + (a.affected_recipes?.length ?? 0), 0);
  const biggestSpike = alerts.length > 0
    ? alerts.reduce((max, a) => Math.abs(a.price_change_pct) > Math.abs(max.price_change_pct) ? a : max, alerts[0])
    : null;

  return (
    <div className="min-h-screen pb-28" style={{ background: "#F7F9FF" }}>

      {/* Header */}
      <div className="glass-nav sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl btn-primary flex items-center justify-center">
              <ChefHat size={16} className="text-white" />
            </div>
            <span className="font-black text-base tracking-tight gradient-text">YIELD</span>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <div className="relative">
                <Bell size={20} className="text-slate-400" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              </div>
            )}
            <button
              onClick={() => supabase.auth.signOut().then(() => router.replace("/"))}
              className="text-slate-400 hover:text-slate-700 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-6 space-y-8">

        {/* Welcome */}
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

        {/* Big scan CTA — état vide */}
        {invoices.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <button
              onClick={openCamera}
              className="w-full card rounded-3xl p-8 text-center card-hover border-2 border-dashed border-blue-200 hover:border-blue-400 transition-colors"
            >
              <div className="w-16 h-16 btn-primary rounded-2xl flex items-center justify-center mx-auto mb-4 glow-blue-sm">
                <Camera size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Scanner mon bon de livraison</h2>
              <p className="text-slate-500 text-sm">
                Photographiez votre bon de livraison. L&apos;IA calcule l&apos;impact matière en 30 secondes.
              </p>
              <div className="mt-5 flex items-center justify-center gap-1.5 text-blue-600 text-sm font-semibold">
                Commencer <ChevronRight size={16} />
              </div>
            </button>
          </motion.div>
        )}

        {/* Bilan Matière */}
        {alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: "linear-gradient(145deg, #1D4ED8, #2563EB 50%, #4F46E5)" }}>
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.12) 0%, transparent 60%)" }} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={15} className="text-blue-200" />
                  <span className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Bilan Matière</span>
                </div>
                <p className="text-2xl font-bold mb-1">{unreadCount} alerte{unreadCount > 1 ? "s" : ""} rendement</p>
                <p className="text-blue-200 text-sm mb-4">
                  {totalRecipesAffected} fiche{totalRecipesAffected > 1 ? "s" : ""} technique{totalRecipesAffected > 1 ? "s" : ""} à ajuster avant le prochain service
                </p>
                {biggestSpike && (
                  <div className="flex items-center justify-between pt-3 border-t border-white/15">
                    <div className="min-w-0">
                      <p className="text-blue-200 text-[10px] uppercase tracking-wider font-semibold mb-0.5">Pire dérive</p>
                      <p className="text-white text-sm font-semibold truncate">{biggestSpike.product_name}</p>
                    </div>
                    <span className="font-mono font-bold text-white bg-white/10 px-2.5 py-1 rounded-lg text-sm flex-shrink-0">
                      +{biggestSpike.price_change_pct.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Alertes Rendement */}
        {alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-slate-900 font-semibold text-base">
                Alertes Rendement
                {unreadCount > 0 && (
                  <span className="ml-2 text-xs label-blue px-2 py-0.5 rounded-full">
                    {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </h2>
            </div>
            <div className="space-y-3">
              {alerts.map(alert => <AlertCard key={alert.id} alert={alert} />)}
            </div>
          </motion.div>
        )}

        {/* Bons de Livraison */}
        {invoices.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-slate-900 font-semibold text-base">Bons de Livraison</h2>
              <button
                onClick={openCamera}
                className="label-blue text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1"
              >
                <Camera size={12} /> Scanner
              </button>
            </div>
            <div className="space-y-3">
              {invoices.map(inv => (
                <div key={inv.id} className="card rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 text-sm font-medium truncate">{inv.supplier_name}</p>
                    <p className="text-slate-400 text-xs">{inv.invoice_date} · {inv.items_count} produits</p>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Rendement nominal */}
        {!loading && alerts.length === 0 && invoices.length > 0 && (
          <div className="card rounded-2xl p-6 text-center">
            <CheckCircle2 size={28} className="text-blue-500 mx-auto mb-3" />
            <p className="text-slate-900 font-semibold mb-1">Rendement nominal.</p>
            <p className="text-slate-400 text-sm">Aucune dérive matière détectée. Votre food cost est stable.</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleScan(file);
          e.target.value = "";
        }}
      />
      <ScannerFAB onClick={openCamera} show={invoices.length > 0} />
      <ConciergeButton />
      <UploadOverlay
        status={uploadStatus}
        onClose={() => setUploadStatus("idle")}
        onRetake={() => { setUploadStatus("idle"); setTimeout(openCamera, 150); }}
      />
      <OnboardingModal
        show={showOnboarding}
        onClose={dismissOnboarding}
        onStart={() => { dismissOnboarding(); openCamera(); }}
      />
    </div>
  );
}
