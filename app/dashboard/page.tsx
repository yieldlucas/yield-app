"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Bell, TrendingDown, ChefHat,
  CheckCircle2, AlertTriangle, FileText, ChevronRight,
  Sparkles, MessageCircle, Crown, X, Download, Settings,
  User, FolderOpen, ChevronDown, HelpCircle, Database,
  Layers, Headphones,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

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

interface BatchItem {
  id: string;
  fileName: string;
  status: "queued" | "uploading" | "processing" | "done" | "error";
  error?: string;
  supplier?: string | null;
  itemsCount?: number;
  // Sous-état pendant 'processing' — alimenté par polling de invoices.processing_step
  processingStep?: "extracting" | "matching" | "alerting" | null;
  totalItemsCount?: number | null;
}

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

// ─── Camera Guide (overlay d'instructions avant ouverture caméra) ───────
// L'app caméra native du téléphone gère mieux que <video>+getUserMedia
// (autofocus, balance des blancs, HDR). On ne peut donc pas dessiner un
// overlay PAR-DESSUS la caméra système — d'où ce sas d'instructions visuel
// AVANT de l'ouvrir, pour que le chef cadre bien sa facture du premier coup.
function CameraGuide({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-slate-900 font-bold text-lg mb-1">Cadrez votre facture</h2>
        <p className="text-slate-500 text-sm mb-5">
          Une bonne photo = une lecture parfaite. Posez le BL sur fond uni et restez à plat.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* OK : facture droite, bien cadrée */}
          <div className="flex flex-col items-center">
            <div className="w-full aspect-[3/4] rounded-xl border-4 border-emerald-500 bg-emerald-50 flex items-center justify-center p-3 mb-2">
              <svg viewBox="0 0 60 80" className="w-full h-full">
                <rect x="10" y="8" width="40" height="64" rx="2" fill="white" stroke="#10b981" strokeWidth="1.5"/>
                <line x1="16" y1="20" x2="44" y2="20" stroke="#94a3b8" strokeWidth="1.5"/>
                <line x1="16" y1="28" x2="44" y2="28" stroke="#cbd5e1" strokeWidth="1"/>
                <line x1="16" y1="36" x2="44" y2="36" stroke="#cbd5e1" strokeWidth="1"/>
                <line x1="16" y1="44" x2="44" y2="44" stroke="#cbd5e1" strokeWidth="1"/>
                <line x1="16" y1="52" x2="44" y2="52" stroke="#cbd5e1" strokeWidth="1"/>
                <line x1="16" y1="60" x2="36" y2="60" stroke="#cbd5e1" strokeWidth="1"/>
              </svg>
            </div>
            <p className="text-emerald-700 text-xs font-semibold text-center">✓ Droite et entière</p>
          </div>

          {/* KO : facture de travers, coupée */}
          <div className="flex flex-col items-center">
            <div className="w-full aspect-[3/4] rounded-xl border-4 border-rose-500 bg-rose-50 flex items-center justify-center p-3 mb-2 overflow-hidden">
              <svg viewBox="0 0 60 80" className="w-full h-full">
                <g transform="rotate(-18 30 40)">
                  <rect x="14" y="10" width="40" height="64" rx="2" fill="white" stroke="#f43f5e" strokeWidth="1.5"/>
                  <line x1="20" y1="22" x2="48" y2="22" stroke="#94a3b8" strokeWidth="1.5"/>
                  <line x1="20" y1="30" x2="48" y2="30" stroke="#cbd5e1" strokeWidth="1"/>
                  <line x1="20" y1="38" x2="48" y2="38" stroke="#cbd5e1" strokeWidth="1"/>
                  <line x1="20" y1="46" x2="48" y2="46" stroke="#cbd5e1" strokeWidth="1"/>
                </g>
              </svg>
            </div>
            <p className="text-rose-700 text-xs font-semibold text-center">✗ Inclinée ou coupée</p>
          </div>
        </div>

        <ul className="text-slate-600 text-sm space-y-1.5 mb-5">
          <li className="flex gap-2"><span className="text-emerald-500">•</span> Lumière du jour ou plafonnier (pas de flash)</li>
          <li className="flex gap-2"><span className="text-emerald-500">•</span> Toute la facture dans le cadre, marges incluses</li>
          <li className="flex gap-2"><span className="text-emerald-500">•</span> Téléphone parallèle à la table</li>
        </ul>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-[2] px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-blue-lg flex items-center justify-center gap-2"
          >
            <Camera size={16} /> J'y vais
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Conciergerie Chef + FAQ Drawer ───────────────────────
const FAQ_ITEMS: { q: string; Icon: typeof Database; a: string }[] = [
  {
    q: "Comment sont conservées mes données ?",
    Icon: Database,
    a: "Vos bons de livraison sont chiffrés (AES-256) et stockés sur des serveurs européens (AWS Paris, RGPD natif). Personne — ni l'équipe YIELD, ni un tiers — n'a accès au contenu de vos factures. Vous pouvez exporter ou supprimer toutes vos données en un clic depuis votre profil.",
  },
  {
    q: "Comment scanner plusieurs pages ?",
    Icon: Layers,
    a: "Au moment du scan, photographiez chaque page une par une depuis le sélecteur d'appareil photo (le bouton « Scanner un BL » garde la session ouverte entre chaque cliché). Pour les BL déjà numérisés en PDF multi-pages, utilisez « Importer » : YIELD lit toutes les pages d'un seul coup.",
  },
  {
    q: "Mon fournisseur n'est pas reconnu",
    Icon: HelpCircle,
    a: "YIELD lit n'importe quel BL imprimé ou manuscrit. Si le nom du fournisseur n'apparaît pas correctement, vous pouvez le corriger manuellement dans le détail de la facture. Le système retient la correction pour les prochains scans.",
  },
  {
    q: "Contacter un humain",
    Icon: Headphones,
    a: "L'équipe YIELD répond sous 2h en jours ouvrés (anciens chefs et restaurateurs). Email : chef@yield.restaurant — précisez votre numéro et l'urgence, on vous rappelle si besoin.",
  },
];

function ConciergeButton() {
  const [open, setOpen] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-5 z-30 w-14 h-14 glass rounded-2xl flex items-center justify-center shadow-card border border-blue-100"
        aria-label="Aide & Conciergerie"
      >
        <MessageCircle size={22} className="text-blue-600" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white shadow-card md:bottom-6 md:left-6 md:right-auto md:w-96 md:rounded-3xl md:max-h-[80vh]"
            >
              <div className="sticky top-0 bg-white/90 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 btn-primary rounded-xl flex items-center justify-center">
                    <ChefHat size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-slate-900 font-bold text-sm">Aide & Conciergerie</p>
                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      Équipe disponible · réponse sous 2h
                    </div>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors" aria-label="Fermer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-2">
                {FAQ_ITEMS.map((item, i) => {
                  const isOpen = openIdx === i;
                  const Icon = item.Icon;
                  return (
                    <div key={i} className={`rounded-2xl border transition-colors ${isOpen ? "border-blue-200 bg-blue-50/30" : "border-slate-100 bg-white"}`}>
                      <button
                        onClick={() => setOpenIdx(isOpen ? null : i)}
                        className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOpen ? "bg-blue-100" : "bg-slate-50"}`}>
                          <Icon size={14} className={isOpen ? "text-blue-600" : "text-slate-500"} />
                        </div>
                        <span className="flex-1 text-sm font-medium text-slate-800">{item.q}</span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden"
                          >
                            <p className="px-4 pb-4 text-sm text-slate-600 leading-relaxed">
                              {item.a}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                <a
                  href="mailto:chef@yield.restaurant?subject=Aide%20YIELD"
                  className="btn-primary w-full mt-2 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Headphones size={15} /> Écrire à l&apos;équipe
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Batch overlay ────────────────────────────────────────
// Message dynamique pour une ligne en cours d'analyse, calé sur processing_step
// remonté par le polling. Donne au chef l'impression d'un vrai travail en cours
// pendant les ~15-25s d'analyse Claude.
function stepMessage(item: BatchItem): string {
  if (item.status === "uploading") return "Envoi de la photo...";
  if (item.status !== "processing") return "";
  switch (item.processingStep) {
    case "extracting": return "Lecture des lignes de la facture...";
    case "matching":
      return item.totalItemsCount
        ? `Analyse des ${item.totalItemsCount} produits détectés...`
        : "Analyse des produits détectés...";
    case "alerting": return "Calcul de l'impact sur vos marges...";
    default: return "Analyse en cours...";
  }
}

function BatchOverlay({
  items, open, onClose, onRetake,
}: {
  items: BatchItem[];
  open: boolean;
  onClose: () => void;
  onRetake: () => void;
}) {
  const total = items.length;
  const done = items.filter(i => i.status === "done").length;
  const errored = items.filter(i => i.status === "error").length;
  const current = items.find(i => i.status === "uploading" || i.status === "processing");
  const allFinished = total > 0 && items.every(i => i.status === "done" || i.status === "error");

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-center p-5">
          <motion.div initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} className="card rounded-3xl p-7 max-w-sm w-full shadow-card">
            <div className="flex items-center gap-3 mb-5">
              <div className="relative w-12 h-12 flex-shrink-0">
                <div className="absolute inset-0 rounded-2xl btn-primary flex items-center justify-center">
                  <ChefHat size={22} className="text-white" />
                </div>
                {!allFinished && (
                  <svg className="absolute inset-0 animate-spin-slow" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="22" stroke="rgba(37,99,235,0.15)" strokeWidth="2" />
                    <path d="M24 2 A22 22 0 0 1 46 24" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-bold text-base">
                  {allFinished ? "Lot traité" : "Analyse du lot"}
                </p>
                <p className="text-slate-400 text-xs">
                  {allFinished
                    ? `${done} traitée${done > 1 ? "s" : ""}${errored > 0 ? ` · ${errored} erreur${errored > 1 ? "s" : ""}` : ""}`
                    : current
                      ? `${done}/${total} · ${stepMessage(current) || current.fileName}`
                      : `${done}/${total}`}
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto mb-5 pr-1">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 ${
                    item.status === "done" ? "border-blue-400 bg-blue-50" :
                    item.status === "error" ? "border-red-400 bg-red-50" :
                    item.status === "uploading" || item.status === "processing" ? "border-blue-500 bg-blue-50" :
                    "border-slate-200"
                  }`}>
                    {item.status === "done" && <CheckCircle2 size={12} className="text-blue-500" />}
                    {item.status === "error" && <AlertTriangle size={11} className="text-red-500" />}
                    {(item.status === "uploading" || item.status === "processing") && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${item.status === "error" ? "text-red-500" : "text-slate-700"}`}>
                      {item.fileName}
                    </p>
                    {item.status === "done" && (item.supplier || item.itemsCount) && (
                      <p className="text-[10px] text-slate-400 truncate">
                        {item.supplier ?? "Fournisseur inconnu"}{item.itemsCount ? ` · ${item.itemsCount} produits` : ""}
                      </p>
                    )}
                    {(item.status === "uploading" || item.status === "processing") && (
                      <p className="text-[10px] text-blue-500 truncate">{stepMessage(item)}</p>
                    )}
                    {item.status === "error" && item.error && (
                      <p className="text-[10px] text-red-400 truncate">{item.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {allFinished && (
              <div className="space-y-2">
                <button onClick={onClose} className="btn-primary w-full py-3 rounded-xl text-sm">
                  Voir les résultats
                </button>
                {errored > 0 && (
                  <button onClick={onRetake} className="w-full py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center gap-1.5">
                    <Camera size={14} /> Reprendre les scans en erreur
                  </button>
                )}
              </div>
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

// ─── Trial banner (Stripe Checkout) ───────────────────────
function TrialBanner({ show, onStart, onDismiss, loading }: { show: boolean; onStart: () => void; onDismiss: () => void; loading: boolean }) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 text-white relative overflow-hidden"
      style={{ background: "linear-gradient(145deg, #1D4ED8, #2563EB 50%, #4F46E5)" }}
    >
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 80% 30%, rgba(255,255,255,0.14) 0%, transparent 60%)" }} />
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
        aria-label="Fermer"
      >
        <X size={16} />
      </button>
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Crown size={14} className="text-blue-200" />
          <span className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Essai gratuit</span>
        </div>
        <p className="text-lg font-bold mb-1">14 jours offerts</p>
        <p className="text-blue-100 text-sm mb-4">
          Scans illimités, alertes temps réel, conciergerie chef. Sans engagement, résiliable en 1 clic.
        </p>
        <button
          onClick={onStart}
          disabled={loading}
          className="w-full bg-white text-blue-700 font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors disabled:opacity-70"
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-blue-200 border-t-blue-700 rounded-full animate-spin" /> Ouverture du paiement…</>
          ) : (
            <>Démarrer l&apos;essai <ChevronRight size={15} /></>
          )}
        </button>
      </div>
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
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTrial, setShowTrial] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  // 402 from /api/invoices/process → essai expiré, paiement obligatoire
  const [paymentRequired, setPaymentRequired] = useState(false);
  // Activation en cours après retour Stripe (course webhook vs redirect)
  const [activatingSubscription, setActivatingSubscription] = useState(false);
  const [subscriptionActivated, setSubscriptionActivated] = useState(false);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [cameraGuideOpen, setCameraGuideOpen] = useState(false);
  // Quota mensuel : { used, quota } — null tant que pas chargé
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Le bouton "Scanner" affiche d'abord un guide de cadrage (cf CameraGuide ci-dessous),
  // puis sur confirmation déclenche la caméra native (capture="environment").
  // `openGallery` ouvre le picker fichiers/galerie pour les anciennes factures.
  const openCamera = () => setCameraGuideOpen(true);
  const launchNativeCamera = () => {
    setCameraGuideOpen(false);
    cameraInputRef.current?.click();
  };
  const openGallery = () => galleryInputRef.current?.click();

  const callApi = async (path: string, init: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/");
      throw new Error("No session");
    }
    return fetch(path, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  };

  const startCheckout = async () => {
    setCheckoutLoading(true);
    setBillingError(null);
    try {
      const res = await callApi("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      if (!data.url) {
        throw new Error("Réponse Stripe invalide (pas d'URL).");
      }
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Paiement indisponible.";
      setBillingError(`Impossible d'ouvrir le paiement : ${msg}`);
      setCheckoutLoading(false);
    }
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    setBillingError(null);
    try {
      const res = await callApi("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      if (!data.url) {
        throw new Error("Portail Stripe indisponible.");
      }
      window.location.href = data.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Portail indisponible.";
      setBillingError(`Impossible d'ouvrir le portail : ${msg}`);
      setPortalLoading(false);
    }
  };

  const exportCSV = async () => {
    setExportLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      // Download via GET avec token en query param (les navigateurs ne préservent pas les headers sur download direct)
      const url = `/api/export/csv?t=${encodeURIComponent(session.access_token)}`;
      window.open(url, "_blank");
    } finally {
      setTimeout(() => setExportLoading(false), 800);
    }
  };

  const dismissTrial = () => {
    localStorage.setItem("yield_trial_dismissed", "1");
    setShowTrial(false);
  };

  // Helper exposé pour rafraîchir le statut abonnement à la demande
  // (poll après retour Stripe, ou call manuel après une action billing)
  const refreshSubscription = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("profiles")
      .select("is_subscribed")
      .eq("id", userId)
      .maybeSingle();
    const subscribed = Boolean((data as { is_subscribed?: boolean } | null)?.is_subscribed);
    setIsSubscribed(subscribed);
    if (subscribed) {
      setShowTrial(false);
      setPaymentRequired(false);
      setBillingError(null);
    }
    return subscribed;
  };

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let pollDeadline = 0;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/"); return; }
      setUser({ email: session.user.email ?? "" });
      loadMockData();

      const userId = session.user.id;
      const subscribed = await refreshSubscription(userId);

      if (typeof window === "undefined") return;
      if (!localStorage.getItem("yield_onboarding_seen")) setShowOnboarding(true);

      const params = new URLSearchParams(window.location.search);
      const cameFromCheckout = params.get("checkout") === "success";
      const dismissed = localStorage.getItem("yield_trial_dismissed") === "1";

      if (cameFromCheckout) {
        // Nettoie l'URL pour ne pas re-déclencher le polling à chaque navigation
        window.history.replaceState({}, "", "/dashboard");
        if (subscribed) {
          // Webhook déjà arrivé → succès direct
          setSubscriptionActivated(true);
          setTimeout(() => setSubscriptionActivated(false), 4000);
        } else {
          // Course : webhook pas encore arrivé. On poll jusqu'à 25s.
          setActivatingSubscription(true);
          pollDeadline = Date.now() + 25_000;
          pollTimer = setInterval(async () => {
            const ok = await refreshSubscription(userId);
            if (ok) {
              if (pollTimer) clearInterval(pollTimer);
              setActivatingSubscription(false);
              setSubscriptionActivated(true);
              setTimeout(() => setSubscriptionActivated(false), 4000);
            } else if (Date.now() > pollDeadline) {
              if (pollTimer) clearInterval(pollTimer);
              setActivatingSubscription(false);
              setBillingError(
                "Activation en attente. Le paiement est validé chez Stripe mais le webhook n'a pas encore mis à jour votre profil. Cliquez sur Rafraîchir ci-dessous, ou attendez 30s puis recharger la page."
              );
            }
          }, 1500);
        }
      } else {
        setShowTrial(!subscribed && !dismissed);
      }
    });

    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem("yield_onboarding_seen", "1");
    setShowOnboarding(false);
  };

  const QUOTA = 200;

  const loadUsage = async () => {
    const yearMonth = new Date().toISOString().slice(0, 7);
    const { data } = await supabase
      .from("usage_stats")
      .select("scan_count")
      .eq("year_month", yearMonth)
      .maybeSingle();
    const used = (data as { scan_count?: number } | null)?.scan_count ?? 0;
    setUsage({ used, quota: QUOTA });
  };

  const loadMockData = () => {
    setLoading(false);
    void loadUsage();
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

  // Traite un fichier unique et retourne le résultat (pour pipeline batch)
  // Erreurs dédiées pour qu'on puisse intercepter et déclencher le bon flow
  class PaymentRequiredError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PaymentRequiredError";
    }
  }
  class QuotaExceededError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "QuotaExceededError";
    }
  }

  // POST déclenche le scan en background, retourne invoice_id immédiatement.
  // Ensuite on poll la table invoices toutes les 3s pour suivre processing_step
  // et mettre à jour la BatchItem avec un message dynamique.
  const processOne = async (
    file: File,
    onStep: (step: { processingStep?: BatchItem["processingStep"]; totalItemsCount?: number | null }) => void,
  ): Promise<{ supplier?: string | null; itemsCount?: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/");
      throw new Error("Session expirée");
    }
    const formData = new FormData();
    formData.append("invoice", file);
    const res = await fetch("/api/invoices/process", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });
    if (res.status === 402) {
      const j = await res.json().catch(() => ({}));
      if (j?.code === "QUOTA_EXCEEDED") {
        throw new QuotaExceededError(j?.error ?? "Quota mensuel atteint");
      }
      throw new PaymentRequiredError(j?.error ?? "Abonnement requis");
    }
    if (!res.ok) {
      let msg = "Lecture impossible";
      try {
        const j = await res.json();
        msg = j?.error ?? msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    const ack = await res.json().catch(() => ({})) as { invoice_id?: string };
    const invoiceId = ack.invoice_id;
    if (!invoiceId) throw new Error("Réponse serveur invalide");

    // ─── Polling 3s ───
    // RLS owner_invoices laisse le user lire sa propre facture, donc client
    // direct via supabase. Timeout dur à 90s pour ne pas poller à l'infini
    // si l'edge function plante silencieusement.
    const POLL_INTERVAL_MS = 3000;
    const POLL_TIMEOUT_MS = 90_000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      const { data, error } = await supabase
        .from("invoices")
        .select("status, processing_step, total_items_count, supplier:suppliers(name)")
        .eq("id", invoiceId)
        .maybeSingle();
      if (error) continue; // transient — on retente
      if (!data) continue;

      const row = data as unknown as {
        status: string;
        processing_step: string | null;
        total_items_count: number | null;
        supplier: { name: string } | null;
      };

      onStep({
        processingStep: row.processing_step as BatchItem["processingStep"],
        totalItemsCount: row.total_items_count,
      });

      if (row.status === "processed") {
        // Récupère le compteur de quota mis à jour (le edge l'a incrémenté)
        const yearMonth = new Date().toISOString().slice(0, 7);
        const { data: u } = await supabase
          .from("usage_stats").select("scan_count")
          .eq("year_month", yearMonth).maybeSingle();
        const used = (u as { scan_count?: number } | null)?.scan_count;
        if (typeof used === "number") {
          setUsage(prev => prev ? { ...prev, used } : { used, quota: QUOTA });
        }
        return {
          supplier: row.supplier?.name ?? null,
          itemsCount: row.total_items_count ?? undefined,
        };
      }
      if (row.status === "duplicate") {
        throw new Error("Cette facture a déjà été enregistrée.");
      }
      if (row.status === "error") {
        throw new Error("Lecture impossible — réessayez avec une photo plus nette.");
      }
    }
    throw new Error("L'analyse prend trop de temps. Réessayez dans un moment.");
  };

  // Helpers pour la gestion d'erreurs dans processBatch
  const isPaymentRequired = (err: unknown): boolean =>
    err instanceof Error && err.name === "PaymentRequiredError";
  const isQuotaExceeded = (err: unknown): boolean =>
    err instanceof Error && err.name === "QuotaExceededError";

  // Lance le traitement séquentiel du lot (non-bloquant pour l'UI)
  const processBatch = async (initial: BatchItem[]) => {
    for (const item of initial) {
      setBatch(b => b.map(x => x.id === item.id ? { ...x, status: "uploading" } : x));
      try {
        // Petit délai pour donner du feedback visuel
        await new Promise(r => setTimeout(r, 400));
        setBatch(b => b.map(x => x.id === item.id ? { ...x, status: "processing" } : x));
        const result = await processOne(
          (item as BatchItem & { file: File }).file,
          (step) => setBatch(b => b.map(x => x.id === item.id ? { ...x, ...step } : x)),
        );
        setBatch(b => b.map(x => x.id === item.id ? {
          ...x, status: "done", supplier: result.supplier, itemsCount: result.itemsCount,
        } : x));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        // ⭐ 402 + QUOTA_EXCEEDED → quota mensuel atteint : on stoppe le batch
        // et on ouvre la modal d'upgrade vers Pro (39.99€). Pas de redirect
        // Stripe automatique : c'est un upsell, pas une obligation de paiement.
        if (isQuotaExceeded(err)) {
          setBatch(b => b.map(x => {
            if (x.id === item.id) return { ...x, status: "error", error: "Quota mensuel atteint" };
            if (x.status === "queued") return { ...x, status: "error", error: "Lot annulé : quota atteint" };
            return x;
          }));
          setBatchOpen(false);
          setQuotaExceeded(true);
          setUsage(u => u ? { ...u, used: u.quota } : { used: QUOTA, quota: QUOTA });
          return;
        }
        // ⭐ 402 → essai expiré : on stoppe le batch et on déclenche le paiement
        if (isPaymentRequired(err)) {
          setBatch(b => b.map(x => {
            if (x.id === item.id) return { ...x, status: "error", error: "Abonnement requis" };
            if (x.status === "queued") return { ...x, status: "error", error: "Lot annulé : abonnement requis" };
            return x;
          }));
          setBatchOpen(false);
          setShowTrial(true);
          setPaymentRequired(true);
          // Auto-redirige vers Stripe après une brève pause (laisse l'utilisateur lire le message)
          setTimeout(() => { void startCheckout(); }, 600);
          return;
        }
        setBatch(b => b.map(x => x.id === item.id ? { ...x, status: "error", error: msg } : x));
      }
    }
    loadMockData();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const queued: (BatchItem & { file: File })[] = Array.from(files).map((file, i) => ({
      id: `${Date.now()}-${i}`,
      fileName: file.name,
      status: "queued",
      file,
    }));
    setBatch(queued);
    setBatchOpen(true);
    processBatch(queued);
  };

  const retryErrored = () => {
    const errored = batch.filter(i => i.status === "error");
    if (errored.length === 0) return;
    setBatchOpen(false);
    setBatch([]);
    openCamera();
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const firstName = user?.email?.split("@")[0] ?? "";
  const totalRecipesAffected = alerts.reduce((sum, a) => sum + (a.affected_recipes?.length ?? 0), 0);
  const biggestSpike = alerts.length > 0
    ? alerts.reduce((max, a) => Math.abs(a.price_change_pct) > Math.abs(max.price_change_pct) ? a : max, alerts[0])
    : null;
  // Cloche : nombre de factures avec invoice_date = aujourd'hui (UTC offset local)
  const today = new Date().toISOString().slice(0, 10);
  const processedToday = invoices.filter(
    i => i.status === "processed" && i.invoice_date?.slice(0, 10) === today
  ).length;
  const bellBadge = unreadCount + processedToday;

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
            <button
              onClick={exportCSV}
              disabled={exportLoading || invoices.length === 0}
              className="text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Export comptable CSV"
              title="Export comptable CSV"
            >
              {exportLoading ? (
                <div className="w-[18px] h-[18px] border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              ) : (
                <Download size={18} />
              )}
            </button>
            {isSubscribed && (
              <button
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-40"
                aria-label="Gérer l'abonnement"
                title="Gérer l'abonnement"
              >
                {portalLoading ? (
                  <div className="w-[18px] h-[18px] border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                ) : (
                  <Settings size={18} />
                )}
              </button>
            )}
            {usage && (() => {
              const pct = (usage.used / usage.quota) * 100;
              const reached = pct >= 100;
              const tone = reached ? "text-rose-600 bg-rose-50 border-rose-200"
                : pct >= 80 ? "text-amber-700 bg-amber-50 border-amber-200"
                : "text-slate-500 bg-slate-50 border-slate-200";
              const className = `px-2 py-1 rounded-lg border text-[11px] font-semibold tabular-nums ${tone}`;
              const label = `${usage.used}/${usage.quota}`;
              const tooltip = `Consommation : ${usage.used} / ${usage.quota} scans ce mois`;
              return reached ? (
                <button onClick={() => setQuotaExceeded(true)} className={className} title={tooltip} aria-label="Quota mensuel atteint">
                  {label}
                </button>
              ) : (
                <span className={className} title={tooltip} aria-label="Quota mensuel">
                  {label}
                </span>
              );
            })()}
            <div className="relative" title={processedToday > 0 ? `${processedToday} BL traités aujourd'hui` : "Aucune notif"}>
              <Bell size={20} className={bellBadge > 0 ? "text-slate-700" : "text-slate-400"} />
              {bellBadge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-blue-600 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                  {bellBadge}
                </span>
              )}
            </div>
            <Link
              href="/dashboard/profile"
              className="text-slate-400 hover:text-blue-600 transition-colors"
              aria-label="Mon profil"
              title="Mon profil"
            >
              <User size={18} />
            </Link>
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

        {/* Activation en cours — webhook Stripe pas encore arrivé après le redirect */}
        {activatingSubscription && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 border-2 border-blue-200 bg-blue-50 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-blue-200 flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-blue-900 font-semibold text-sm">Activation de votre abonnement…</p>
              <p className="text-blue-700 text-xs">Stripe confirme le paiement, ça prend quelques secondes.</p>
            </div>
          </motion.div>
        )}

        {/* Confirmation paiement réussi — auto-disparait après 4s */}
        {subscriptionActivated && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 border-2 border-emerald-200 bg-emerald-50 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-emerald-900 font-semibold text-sm">Bienvenue chez YIELD Pro</p>
              <p className="text-emerald-700 text-xs">Scans illimités, alertes temps réel, conciergerie.</p>
            </div>
          </motion.div>
        )}

        {/* Essai expiré (402 reçu sur /api/invoices/process) — non-dismissable */}
        {paymentRequired && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 text-white relative overflow-hidden border-2 border-red-300"
            style={{ background: "linear-gradient(145deg, #B91C1C, #DC2626 50%, #EF4444)" }}
          >
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 80% 30%, rgba(255,255,255,0.14) 0%, transparent 60%)" }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-red-100" />
                <span className="text-red-100 text-xs font-semibold uppercase tracking-wider">Essai terminé</span>
              </div>
              <p className="text-lg font-bold mb-1">Votre essai gratuit est expiré</p>
              <p className="text-red-100 text-sm mb-4">
                Pour continuer à scanner vos bons de livraison, abonnez-vous. Sans engagement, résiliable en 1 clic.
              </p>
              <button
                onClick={startCheckout}
                disabled={checkoutLoading}
                className="w-full bg-white text-red-700 font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-70"
              >
                {checkoutLoading ? (
                  <><div className="w-4 h-4 border-2 border-red-200 border-t-red-700 rounded-full animate-spin" /> Ouverture du paiement…</>
                ) : "S'abonner maintenant"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Essai gratuit Stripe (caché si paymentRequired prend le relais) */}
        {!paymentRequired && (
          <TrialBanner
            show={showTrial}
            loading={checkoutLoading}
            onStart={startCheckout}
            onDismiss={dismissTrial}
          />
        )}
        {billingError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 bg-amber-50 border border-amber-200 flex items-start gap-3"
          >
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-800 text-sm font-medium">Activation en attente</p>
              <p className="text-amber-700 text-xs leading-relaxed mt-0.5 break-words">{billingError}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return;
                    const ok = await refreshSubscription(session.user.id);
                    if (ok) {
                      setBillingError(null);
                      setSubscriptionActivated(true);
                      setTimeout(() => setSubscriptionActivated(false), 4000);
                    }
                  }}
                  className="btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold"
                >
                  Rafraîchir le statut
                </button>
                <button onClick={() => setBillingError(null)} className="text-amber-600 hover:text-amber-800 text-xs underline">
                  Fermer
                </button>
              </div>
            </div>
          </motion.div>
        )}

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
            <button
              onClick={openGallery}
              className="w-full mt-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <FolderOpen size={14} /> Importer un fichier (anciennes factures)
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
              <div className="flex items-center gap-2">
                <button
                  onClick={openGallery}
                  className="text-slate-400 hover:text-blue-600 transition-colors text-xs flex items-center gap-1 font-medium"
                  title="Importer une facture déjà prise en photo"
                >
                  <FolderOpen size={13} /> Importer
                </button>
                <button
                  onClick={openCamera}
                  className="label-blue text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1"
                >
                  <Camera size={12} /> Scanner
                </button>
              </div>
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

      {/* Caméra directe — l'attribut capture déclenche l'app photo native sur mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        capture="environment"
        className="hidden"
        onChange={e => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {/* Picker fichiers / galerie — pas de capture, ouvre le sélecteur natif */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        className="hidden"
        onChange={e => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <ScannerFAB onClick={openCamera} show={invoices.length > 0} />
      <CameraGuide
        open={cameraGuideOpen}
        onConfirm={launchNativeCamera}
        onCancel={() => setCameraGuideOpen(false)}
      />
      {quotaExceeded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setQuotaExceeded(false)}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
              <Sparkles size={22} className="text-blue-600" />
            </div>
            <h2 className="text-slate-900 font-bold text-lg mb-2">
              Vous scannez beaucoup — bravo !
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-2">
              Vous avez utilisé vos <strong>{QUOTA} scans</strong> inclus dans le forfait Lancement ce mois-ci.
              C'est le signe d'une cuisine très active.
            </p>
            <p className="text-slate-600 text-sm leading-relaxed mb-5">
              Pour continuer à scanner sans limite jusqu'à la fin du mois et débloquer les outils Business
              Intelligence (détection d'écarts fournisseur, export comptable Sage/EBP, alertes marge cassée
              en temps réel), passez au forfait <strong>Pro à 39,99€/mois</strong>.
            </p>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mb-5">
              <p className="text-slate-500 text-xs leading-relaxed">
                Le quota se réinitialise automatiquement le 1er du mois prochain. Aucune action requise si vous
                préférez attendre.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setQuotaExceeded(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm"
              >
                Plus tard
              </button>
              <button
                onClick={() => { setQuotaExceeded(false); void startCheckout(); }}
                className="flex-[2] px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm shadow-blue-lg flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> Découvrir le Pro
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      <ConciergeButton />
      <BatchOverlay
        items={batch}
        open={batchOpen}
        onClose={() => { setBatchOpen(false); setBatch([]); }}
        onRetake={retryErrored}
      />
      <OnboardingModal
        show={showOnboarding}
        onClose={dismissOnboarding}
        onStart={() => { dismissOnboarding(); openCamera(); }}
      />
    </div>
  );
}
