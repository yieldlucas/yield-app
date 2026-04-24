"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Camera, Zap, Bell, ShieldCheck, Clock, TrendingDown,
  TrendingUp, Euro, ChefHat, Lock, Server, ArrowRight, ArrowLeft,
  CheckCircle2, Star, Menu, X, Scale, Timer, MessageCircle, KeyRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

// ─── Animated counter ────────────────────────────────────
function useCounter(target: number, duration = 1800, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = easeOut(Math.min((ts - start) / duration, 1));
      setCount(Math.round(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, active]);
  return count;
}

// ─── Shader background ───────────────────────────────────
function ShaderBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden noise" style={{ background: "#F7F9FF" }}>
      {/* Subtle kitchen grid — carnet de recettes */}
      <div className="absolute inset-0" style={{
        backgroundImage: "linear-gradient(rgba(37,99,235,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.025) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      <div className="absolute animate-blob-1" style={{
        width: 800, height: 700,
        borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
        background: "radial-gradient(circle, rgba(79,70,229,0.09) 0%, transparent 70%)",
        top: "-20%", left: "-15%",
        filter: "blur(80px)",
      }} />
      <div className="absolute animate-blob-2" style={{
        width: 900, height: 700,
        borderRadius: "30% 70% 70% 30% / 30% 52% 48% 70%",
        background: "radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)",
        bottom: "-25%", right: "-20%",
        filter: "blur(100px)",
      }} />
      <div className="absolute animate-blob-3" style={{
        width: 600, height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 70%)",
        top: "35%", left: "40%",
        filter: "blur(120px)",
      }} />
    </div>
  );
}

// ─── Navigation ──────────────────────────────────────────
function Nav({ onCTA }: { onCTA: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "glass-nav py-3" : "py-5"
      }`}
    >
      <div className="max-w-6xl mx-auto px-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl btn-primary flex items-center justify-center">
            <ChefHat size={17} className="text-white" />
          </div>
          <span className="font-black text-lg tracking-tight gradient-text">YIELD</span>
        </div>

        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-500">
          <a href="#comment" className="hover:text-slate-900 transition-colors">Fonctionnement</a>
          <a href="#roi" className="hover:text-slate-900 transition-colors">ROI</a>
          <a href="#securite" className="hover:text-slate-900 transition-colors">Sécurité</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button onClick={onCTA} className="btn-primary text-sm px-5 py-2.5 rounded-xl">
            Démarrer le service
          </button>
        </div>

        <button className="md:hidden text-slate-500" onClick={() => setMobileOpen(v => !v)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden glass-nav overflow-hidden"
          >
            <div className="px-5 py-4 flex flex-col gap-4 text-sm font-medium text-slate-600">
              <a href="#comment" onClick={() => setMobileOpen(false)}>Fonctionnement</a>
              <a href="#roi" onClick={() => setMobileOpen(false)}>ROI</a>
              <a href="#securite" onClick={() => setMobileOpen(false)}>Sécurité</a>
              <button onClick={onCTA} className="btn-primary py-3 rounded-xl text-sm">
                Démarrer le service
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────
function HeroSection({ onCTA }: { onCTA: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-screen flex flex-col items-center justify-center text-center px-5 pt-24">
      <motion.div style={{ y, opacity }} className="max-w-4xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="inline-flex items-center gap-2 label-blue rounded-full px-4 py-2 text-sm font-medium mb-8"
        >
          <Timer size={14} className="text-blue-500" />
          Précision chef. Rendement garanti.
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="text-5xl md:text-7xl font-bold text-slate-900 leading-[1.07] tracking-tight mb-6"
        >
          Votre marge fond.
          <br />
          <span className="gradient-text">En silence.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10"
        >
          À chaque livraison, vos fournisseurs ajustent leurs tarifs.{" "}
          <span className="text-slate-800 font-semibold">YIELD lit vos bons de livraison en 30 secondes</span>{" "}
          et vous alerte avant que votre rendement ne s&apos;effondre.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={onCTA}
            className="btn-primary w-full sm:w-auto text-base px-8 py-4 rounded-2xl flex items-center justify-center gap-2.5 group"
          >
            Démarrer le service — gratuit
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <a href="#comment" className="text-slate-400 hover:text-slate-700 text-sm font-medium flex items-center gap-1.5 transition-colors">
            Comment ça marche
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75 }}
          className="mt-12 flex items-center justify-center gap-6 flex-wrap"
        >
          {["Premier scan en 2 minutes", "Sans carte bancaire", "RGPD · Hébergé en Europe"].map((text, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm text-slate-400">
              <CheckCircle2 size={14} className="text-blue-500" />
              {text}
            </div>
          ))}
        </motion.div>

        {/* Floating mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 max-w-sm mx-auto animate-float"
        >
          <div className="glass card-hover rounded-3xl p-5 text-left">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs text-slate-500 font-medium">Analyse BL — Metro Cash &amp; Carry</span>
            </div>
            <div className="space-y-2.5">
              {[
                { name: "Filet de saumon", change: "+14.2%", bad: true },
                { name: "Tomates cerises", change: "+3.5%", bad: true },
                { name: "Beurre doux AOP", change: "−1.0%", bad: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{item.name}</span>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg ${
                    item.bad ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                  }`}>{item.change}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Impact rendement estimé</span>
                <span className="font-bold font-mono text-red-600">−184 €/mois</span>
              </div>
              <div className="btn-primary text-center text-xs py-2 rounded-xl">
                2 alertes rendement générées
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="w-5 h-8 glass rounded-full flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-2 bg-blue-400 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────
function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setActive(true); },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pct = useCounter(6, 1600, active);
  const hours = useCounter(4, 1400, active);
  const k = useCounter(12, 2000, active);

  const stats = [
    { value: `${pct}%`, label: "de rendement qui s'évapore chaque année — hausses fournisseurs passées sous le radar", Icon: TrendingDown, color: "text-red-500" },
    { value: `${hours}h`, label: "par semaine à recalculer les food costs à la main, entre deux services", Icon: Clock, color: "text-amber-500" },
    { value: `${k}k€`, label: "de marge perdue par an sur un restaurant à 500 k€ de CA", Icon: Euro, color: "text-blue-600" },
  ];

  return (
    <section ref={ref} className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-blue-600 uppercase tracking-widest text-xs font-semibold mb-3">Le constat net</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">L&apos;inflation silencieuse qui ronge votre rendement</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {stats.map(({ value, label, Icon, color }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.6 }}
              className="card rounded-2xl p-8 card-hover"
            >
              <Icon className={`${color} mb-5`} size={28} />
              <div className={`text-5xl font-bold ${color} mb-3 font-mono tabular-nums`}>{value}</div>
              <p className="text-slate-500 text-sm leading-relaxed">{label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      number: "01", Icon: Camera,
      title: "Photographiez votre bon de livraison",
      subtitle: "En cuisine, à réception, en 5 secondes",
      description: "À réception de la marchandise, ouvrez YIELD et photographiez le bon. Pas de tableur, pas de ressaisie. La matière première est immédiatement sous contrôle.",
      detail: "Compatible Metro, Promocash, Transgourmet, grossistes locaux et toute facture PDF.",
      mockup: <InvoiceMockup />,
    },
    {
      number: "02", Icon: Zap,
      title: "Lecture IA en 30 secondes chrono",
      subtitle: "Claude Vision lit, compare, calcule",
      description: "Notre IA extrait chaque ligne de matière première, identifie les produits et compare instantanément avec vos prix historiques. Aucune action de votre part.",
      detail: "Précision > 97% sur les bons manuscrits et imprimés. TVA détectée automatiquement.",
      mockup: <AIMockup />,
    },
    {
      number: "03", Icon: Bell,
      title: "Alerte rendement si la variation dépasse 3%",
      subtitle: "Votre rendement protégé en temps réel",
      description: "Dès qu'un prix matière dépasse le seuil, YIELD calcule l'impact net sur chaque fiche technique. Vous ajustez votre carte avant le prochain coup de feu.",
      detail: "Visualisez quelles fiches techniques sont impactées et de combien de points.",
      mockup: <AlertMockup />,
    },
  ];

  return (
    <section id="comment" className="py-32 px-5">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-blue-600 uppercase tracking-widest text-xs font-semibold mb-3">Fonctionnement</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            3 étapes. <span className="gradient-text">Chrono.</span>
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">Conçu pour le terrain. Pour le coup de feu. Pour le Chef.</p>
        </motion.div>

        <div className="space-y-28">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 48 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className={`grid md:grid-cols-2 gap-12 items-center ${
                i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="step-badge text-3xl font-bold px-4 py-2 rounded-2xl font-mono">{step.number}</span>
                  <div className="h-px flex-1 divider-gradient" />
                </div>
                <div className="flex items-center gap-2 text-blue-600 text-sm font-semibold mb-3">
                  <step.Icon size={15} /> {step.subtitle}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">{step.title}</h3>
                <p className="text-slate-500 leading-relaxed mb-5">{step.description}</p>
                <div className="glass-blue rounded-xl px-4 py-3 text-sm text-slate-500 italic">{step.detail}</div>
              </div>
              <div className="flex justify-center">{step.mockup}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Mockups ──────────────────────────────────────────────
function InvoiceMockup() {
  return (
    <div className="relative w-64 h-80 card rounded-3xl overflow-hidden shadow-card">
      <div className="absolute top-0 inset-x-0 h-6 bg-slate-100 flex items-center justify-center">
        <div className="w-16 h-3 rounded-b-lg bg-slate-200" />
      </div>
      <div className="absolute inset-0 top-6 bg-white p-4">
        <div className="space-y-2 pt-2">
          {[78, 65, 82, 58, 70].map((w, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="h-2.5 bg-slate-100 rounded" style={{ width: `${w}%` }} />
              <div className="h-2.5 bg-slate-100 rounded w-12 flex-shrink-0" />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 top-6" style={{ height: "calc(100% - 24px)" }}>
          <div className="scan-line" />
        </div>
        {[["top-2 left-2", "border-t-2 border-l-2"], ["top-2 right-2", "border-t-2 border-r-2"], ["bottom-2 left-2", "border-b-2 border-l-2"], ["bottom-2 right-2", "border-b-2 border-r-2"]].map(([pos, border], i) => (
          <div key={i} className={`absolute ${pos} w-5 h-5 border-blue-500 ${border} rounded-sm`} />
        ))}
      </div>
      <div className="absolute bottom-4 inset-x-0 flex justify-center">
        <div className="w-12 h-12 rounded-full btn-primary flex items-center justify-center glow-blue-sm">
          <Camera size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function AIMockup() {
  const lines = [
    { name: "Saumon", prev: "16.20€", curr: "18.50€", up: true },
    { name: "Tomates", prev: "3.10€", curr: "3.20€", up: true },
    { name: "Huile olive", prev: "27.50€", curr: "28.90€", up: true },
    { name: "Beurre AOP", prev: "4.80€", curr: "4.75€", up: false },
  ];
  return (
    <div className="w-72 card rounded-2xl overflow-hidden shadow-card">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse-slow" />
        <span className="text-xs text-slate-500 font-medium">Lecture matière en cours…</span>
      </div>
      <div className="p-4 space-y-3">
        {lines.map((l, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex items-center justify-between">
            <span className="text-sm text-slate-700">{l.name}</span>
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-slate-400">{l.prev}</span>
              <span className="text-slate-300">→</span>
              <span className="text-slate-800 font-semibold">{l.curr}</span>
              <span className={`font-bold px-1.5 py-0.5 rounded-md text-[11px] ${l.up ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>
                {l.up ? "↑" : "↓"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <div className="btn-primary w-full text-center text-xs py-2.5 rounded-xl">3 alertes rendement générées</div>
      </div>
    </div>
  );
}

function AlertMockup() {
  return (
    <div className="w-72 space-y-3">
      {[
        { product: "Filet de saumon", change: "+14.2%", recipes: "Tartare, Pavé grillé", impact: "−3.2 pts rendement" },
        { product: "Huile d'olive AOP", change: "+5.1%", recipes: "Salade, Pasta", impact: "−0.9 pts rendement" },
      ].map((alert, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="card rounded-2xl p-4 border-l-4 border-blue-500">
          <div className="flex justify-between items-start mb-1.5">
            <span className="text-slate-800 font-semibold text-sm">{alert.product}</span>
            <span className="text-red-500 font-bold text-sm font-mono bg-red-50 px-2 py-0.5 rounded-lg">{alert.change}</span>
          </div>
          <p className="text-xs text-slate-400 mb-2">Fiches techniques : {alert.recipes}</p>
          <div className="flex items-center gap-1.5">
            <TrendingDown size={11} className="text-blue-500" />
            <span className="text-blue-600 text-xs font-semibold">{alert.impact}</span>
          </div>
        </motion.div>
      ))}
      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="glass-blue rounded-xl p-3 text-center">
        <span className="text-xs text-slate-500">Récupérez </span>
        <span className="text-xs text-blue-600 font-semibold">+1 840€/mois</span>
        <span className="text-xs text-slate-500"> en ajustant votre carte</span>
      </motion.div>
    </div>
  );
}

// ─── ROI Section ──────────────────────────────────────────
function ROISection() {
  const scans = [
    {
      n: 1,
      product: "Filet de saumon",
      supplier: "Metro Cash & Carry",
      hausse: "+14.2%",
      mensuel: "94€",
      annuel: "1 128€",
    },
    {
      n: 2,
      product: "Huile d'olive AOP",
      supplier: "Transgourmet",
      hausse: "+5.1%",
      mensuel: "28€",
      annuel: "336€",
    },
    {
      n: 3,
      product: "Beurre AOC 82%",
      supplier: "Promocash",
      hausse: "+8.7%",
      mensuel: "31€",
      annuel: "372€",
    },
  ];

  return (
    <section id="roi" className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-blue-600 uppercase tracking-widest text-xs font-semibold mb-3">Retour sur investissement</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            En 3 scans,{" "}
            <span className="gradient-text">YIELD est rentabilisé.</span>
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Abonnement YIELD : 49€/mois. Économies récupérées lors des 3 premiers scans :{" "}
            <span className="font-semibold text-slate-700">153€/mois</span> — soit 3× le coût de l&apos;abonnement.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {scans.map((scan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="card rounded-2xl p-6 relative overflow-hidden card-hover"
            >
              <div className="absolute top-4 right-4 step-badge text-xs font-bold px-2.5 py-1 rounded-lg font-mono">
                Scan #{scan.n}
              </div>
              <div className="w-10 h-10 glass-blue rounded-xl flex items-center justify-center mb-4">
                <Scale size={18} className="text-blue-600" />
              </div>
              <p className="text-xs text-slate-400 font-medium mb-1">{scan.supplier}</p>
              <h3 className="text-slate-900 font-bold mb-3">{scan.product}</h3>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-bold text-red-500 font-mono">{scan.hausse}</span>
                <span className="text-slate-400 text-sm">matière première</span>
              </div>
              <div className="glass-blue rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Économie récupérée</p>
                <p className="text-blue-700 font-bold text-lg font-mono">
                  {scan.mensuel}<span className="text-blue-400 text-sm font-normal">/mois</span>
                </p>
                <p className="text-blue-400 text-xs font-mono">{scan.annuel}/an</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="card rounded-2xl p-8 border border-blue-100"
        >
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="text-center">
              <p className="text-slate-400 text-sm mb-2">Abonnement YIELD</p>
              <p className="text-3xl font-bold text-slate-900 font-mono">
                49€<span className="text-base font-normal text-slate-400">/mois</span>
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold gradient-text font-mono">25×</div>
              <p className="text-slate-500 text-sm mt-1">ROI moyen constaté</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm mb-2">Économies détectées</p>
              <p className="text-3xl font-bold text-blue-600 font-mono">
                1 247€<span className="text-base font-normal text-slate-400">/mois</span>
              </p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-600 text-sm">
              <span className="font-semibold text-slate-900">Dès votre 3ème scan,</span>{" "}
              YIELD vous a rapporté plus qu&apos;il ne coûte.{" "}
              <span className="text-blue-600 font-semibold">Rentabilité garantie ou remboursé.</span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Benefits ─────────────────────────────────────────────
function BenefitsSection() {
  const benefits = [
    { Icon: Clock, title: "2 min. Pas 2 heures.", description: "Fini les tableurs Excel et la ressaisie manuelle. Une photo du bon, et c'est fait. Votre équipe reste concentrée sur le coup de feu.", metric: "−95%", metricLabel: "temps de contrôle" },
    { Icon: TrendingUp, title: "Récupérez vos points de rendement", description: "Nos utilisateurs récupèrent en moyenne 3 à 5 points de marge nette dès les 6 premières semaines en ajustant leur carte au bon moment.", metric: "+4 pts", metricLabel: "rendement net moyen" },
    { Icon: ShieldCheck, title: "Votre P&L, sous contrôle", description: "Chaque bon de livraison est contrôlé. Chaque hausse matière est détectée. Votre fin de mois ne vous réserve plus de mauvaises surprises.", metric: "100%", metricLabel: "des BL contrôlés" },
  ];

  return (
    <section id="benefices" className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid md:grid-cols-2 gap-6 mb-20">
          <div className="card rounded-2xl p-8 border-l-4 border-red-300">
            <p className="text-red-500 text-xs font-semibold uppercase tracking-widest mb-5">Avant YIELD</p>
            <ul className="space-y-3">
              {[
                "Vous découvrez la hausse 2 mois après",
                "Vous avez servi 400 couverts à perte",
                "Vos fiches techniques sont obsolètes",
                "Votre comptable vous annonce le manque à gagner",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-slate-500 text-sm">
                  <X size={14} className="text-red-400 flex-shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="card rounded-2xl p-8 border-l-4 border-blue-400">
            <p className="text-blue-600 text-xs font-semibold uppercase tracking-widest mb-5">Avec YIELD</p>
            <ul className="space-y-3">
              {[
                "Alerte le jour même de la livraison",
                "Vous ajustez votre prix de vente immédiatement",
                "Fiches techniques mises à jour automatiquement",
                "Votre rendement reste sous contrôle 24h/24",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-slate-700 text-sm">
                  <CheckCircle2 size={14} className="text-blue-500 flex-shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {benefits.map(({ Icon, title, description, metric, metricLabel }, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} className="card rounded-2xl p-7 card-hover flex flex-col">
              <div className="w-11 h-11 glass-blue rounded-xl flex items-center justify-center mb-5">
                <Icon size={20} className="text-blue-600" />
              </div>
              <div className="mb-3">
                <span className="text-3xl font-bold gradient-text font-mono">{metric}</span>
                <span className="text-slate-400 text-sm ml-2">{metricLabel}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed flex-1">{description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────
function TestimonialsSection() {
  const quotes = [
    {
      initials: "TM",
      name: "Thomas M.",
      role: "Chef-propriétaire",
      restaurant: "Le Comptoir du Marché",
      location: "Lyon 2e",
      quote: "J'ai récupéré 8 points de marge en 4 mois. Le saumon de mon fournisseur avait pris 18% en 6 semaines. Sans YIELD, je servais à perte sans le savoir.",
    },
    {
      initials: "SR",
      name: "Sarah R.",
      role: "Cheffe exécutive",
      restaurant: "Brasserie Nord",
      location: "Paris 9e",
      quote: "Avant, je passais mes dimanches soir sur Excel. Maintenant je photographie les BL à réception, et le lundi matin je vois exactement quelles fiches ajuster. 3h par semaine économisées.",
    },
    {
      initials: "KB",
      name: "Karim B.",
      role: "Chef",
      restaurant: "L'Atelier des Saveurs",
      location: "Marseille 7e",
      quote: "Mon fournisseur d'huile d'olive a augmenté 3 fois en un trimestre. YIELD m'a alerté à chaque fois. J'ai renégocié mes tarifs et changé un produit. Rentabilisé dès le premier mois.",
    },
  ];

  return (
    <section className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-blue-600 uppercase tracking-widest text-xs font-semibold mb-3">Ils ont repris le contrôle</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
            Des chefs qui ne servent plus <span className="gradient-text">à perte</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {quotes.map((q, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="card rounded-2xl p-6 card-hover flex flex-col"
            >
              <div className="flex items-center gap-1 mb-4">
                {Array(5).fill(0).map((_, s) => <Star key={s} size={13} className="text-amber-400 fill-amber-400" />)}
              </div>
              <blockquote className="text-slate-700 text-sm leading-relaxed mb-6 flex-1">
                « {q.quote} »
              </blockquote>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <div className="w-10 h-10 btn-primary rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{q.initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-slate-900 text-sm font-semibold truncate">{q.name}</p>
                  <p className="text-slate-400 text-xs truncate">{q.role} · {q.restaurant}</p>
                  <p className="text-slate-300 text-xs">{q.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Story ────────────────────────────────────────────────
function StorySection() {
  return (
    <section className="py-24 px-5">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="card rounded-3xl p-10 md:p-14 relative overflow-hidden">
          <div className="absolute top-5 right-8 text-8xl text-blue-100 font-serif leading-none select-none">"</div>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex -space-x-3">
              {["#2563EB", "#4F46E5", "#0EA5E9"].map((color, i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center" style={{ background: `${color}18`, borderColor: color }}>
                  <ChefHat size={15} style={{ color }} />
                </div>
              ))}
            </div>
            <div>
              <p className="text-slate-900 text-sm font-semibold">L&apos;équipe YIELD</p>
              <p className="text-slate-400 text-xs">Anciens restaurateurs · Paris &amp; Lyon</p>
            </div>
          </div>
          <blockquote className="text-slate-800 text-xl md:text-2xl font-medium leading-relaxed mb-6">
            On a géré des restaurants pendant{" "}
            <span className="gradient-text font-bold">15 ans</span>. On a vécu cette douleur chaque mois — découvrir trop tard que le coût matière avait explosé, qu&apos;on avait servi 300 couverts à perte parce que le saumon avait pris 12% et qu&apos;on ne l&apos;avait pas vu.
          </blockquote>
          <p className="text-slate-500 leading-relaxed mb-4">On a construit YIELD parce que cet outil n&apos;existait pas. On voulait quelque chose d&apos;aussi simple qu&apos;un SMS — une photo, une alerte. Rien de plus.</p>
          <p className="text-slate-500 leading-relaxed">Aujourd&apos;hui, YIELD surveille votre rendement pendant que vous cuisinez, servez et gérez votre brigade. C&apos;est ça, la restauration moderne.</p>
          <div className="flex items-center gap-1 mt-8">
            {Array(5).fill(0).map((_, i) => <Star key={i} size={16} className="text-amber-400 fill-amber-400" />)}
            <span className="text-slate-400 text-sm ml-2">4.9/5 · 120+ restaurants</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Security ─────────────────────────────────────────────
function SecuritySection() {
  const items = [
    { Icon: Lock, title: "Chiffrement bout-en-bout", text: "Vos données et bons de livraison sont chiffrés AES-256 au repos et en transit. Personne d'autre que vous n'y accède." },
    { Icon: Server, title: "Hébergé en Europe", text: "Infrastructure AWS eu-west-3 (Paris). Conformité RGPD native. Aucune donnée ne sort de l'Union Européenne." },
    { Icon: ShieldCheck, title: "Sans mot de passe", text: "Accès par Magic Link uniquement. Pas de mot de passe à retenir, pas de risque de fuite de credentials." },
    { Icon: CheckCircle2, title: "Vos données vous appartiennent", text: "Export complet à tout moment. Suppression totale sur demande sous 48h. Aucune revente, jamais." },
  ];

  return (
    <section id="securite" className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <p className="text-blue-600 uppercase tracking-widest text-xs font-semibold mb-3">Sécurité</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Vos données sont entre de <span className="gradient-text">bonnes mains</span>
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto">Conçu avec la même exigence que nous avions pour nos restaurants — zéro compromis.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-5">
          {items.map(({ Icon, title, text }, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="card rounded-2xl p-6 flex gap-4 card-hover">
              <div className="w-10 h-10 glass-blue rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-slate-900 font-semibold mb-1.5">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
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
        transition={{ delay: 2 }}
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
              Un problème de scan ? Un doute sur un bon ? Notre équipe de restaurateurs vous répond sous 2h.
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

// ─── OTP Input (6 digits) ─────────────────────────────────
function OTPInput({
  value, onChange, disabled, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setDigit = (i: number, d: string) => {
    const next = digits.map((c, k) => (k === i ? d : c)).join("").trimEnd();
    onChange(next);
  };

  const handleChange = (i: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setDigit(i, " ");
      return;
    }
    // Support paste of full code
    if (clean.length > 1) {
      const padded = clean.slice(0, 6 - i);
      const next = (value.slice(0, i) + padded).slice(0, 6);
      onChange(next);
      refs.current[Math.min(i + padded.length, 5)]?.focus();
      return;
    }
    setDigit(i, clean);
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i].trim() && i > 0) {
      refs.current[i - 1]?.focus();
      setDigit(i - 1, " ");
      e.preventDefault();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={(e) => {
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (pasted) {
        onChange(pasted);
        refs.current[Math.min(pasted.length, 5)]?.focus();
        e.preventDefault();
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="tel"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.currentTarget.select()}
          className="w-11 h-14 md:w-12 md:h-14 text-center text-xl font-bold font-mono bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:bg-white disabled:opacity-60 transition-all tabular-nums"
        />
      ))}
    </div>
  );
}

// ─── CTA Modal ────────────────────────────────────────────
function CTASection({ show, onClose }: { show: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "verifying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendIn, setResendIn] = useState(0);

  // Reset quand le modal se ferme
  useEffect(() => {
    if (!show) {
      setTimeout(() => {
        setStep("email");
        setEmail("");
        setCode("");
        setStatus("idle");
        setErrorMsg("");
        setResendIn(0);
      }, 300);
    }
  }, [show]);

  // Timer de renvoi
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async (emailToUse: string) => {
    setStatus("sending");
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: emailToUse,
      options: { shouldCreateUser: true },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message.includes("rate") ? "Trop de tentatives. Attendez 60 secondes." : "Email invalide ou erreur d'envoi.");
      return;
    }
    setStep("code");
    setStatus("idle");
    setResendIn(30);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("Adresse email invalide");
      setStatus("error");
      return;
    }
    sendCode(email);
  };

  const verifyCode = async (token: string) => {
    setStatus("verifying");
    setErrorMsg("");
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message.includes("expired") ? "Code expiré. Demandez-en un nouveau." : "Code incorrect. Vérifiez les 6 chiffres.");
      setCode("");
      return;
    }
    setStatus("success");
    // Session persistée par Supabase, redirection vers le dashboard
    setTimeout(() => router.replace("/dashboard"), 400);
  };

  // Auto-submit quand les 6 chiffres sont saisis
  useEffect(() => {
    if (step === "code" && code.length === 6 && status !== "verifying" && status !== "success") {
      verifyCode(code);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  const goBackToEmail = () => {
    setStep("email");
    setCode("");
    setStatus("idle");
    setErrorMsg("");
  };

  const resend = () => {
    if (resendIn > 0) return;
    setCode("");
    sendCode(email);
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-5"
          >
            <div className="w-full max-w-md glass rounded-3xl p-8 relative shadow-blue-lg overflow-hidden">
              <button
                onClick={onClose}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors z-10"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>

              {/* Succès */}
              {status === "success" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <div className="w-16 h-16 glass-blue rounded-full flex items-center justify-center mx-auto mb-5">
                    <CheckCircle2 size={32} className="text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Connecté</h3>
                  <p className="text-slate-500 text-sm">Redirection vers votre tableau de bord…</p>
                </motion.div>
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  {/* Étape 1 : Email */}
                  {step === "email" && (
                    <motion.div
                      key="email"
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="text-center mb-7">
                        <div className="w-14 h-14 btn-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <ChefHat size={26} className="text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Démarrer le service</h3>
                        <p className="text-slate-500 text-sm">
                          On vous envoie un code à 6 chiffres par email. Sans mot de passe, sans friction.
                        </p>
                      </div>
                      <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={e => { setEmail(e.target.value); if (status === "error") { setStatus("idle"); setErrorMsg(""); } }}
                          placeholder="votre@email.com"
                          autoComplete="email"
                          inputMode="email"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                        <button
                          type="submit"
                          disabled={status === "sending"}
                          className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70 text-sm"
                        >
                          {status === "sending" ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Envoi du code…</>
                          ) : (
                            <>Envoyer le code <ArrowRight size={16} /></>
                          )}
                        </button>
                        {status === "error" && errorMsg && (
                          <p className="text-red-500 text-xs text-center">{errorMsg}</p>
                        )}
                      </form>
                      <p className="text-center text-slate-400 text-xs mt-5">
                        En continuant, vous acceptez nos{" "}
                        <a href="#" className="underline hover:text-slate-600">CGU</a> et notre{" "}
                        <a href="#" className="underline hover:text-slate-600">politique de confidentialité</a>.
                      </p>
                    </motion.div>
                  )}

                  {/* Étape 2 : Code OTP */}
                  {step === "code" && (
                    <motion.div
                      key="code"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 30 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="text-center mb-6">
                        <div className="w-14 h-14 btn-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <KeyRound size={24} className="text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Entrez le code</h3>
                        <p className="text-slate-500 text-sm">
                          Code à 6 chiffres envoyé à{" "}
                          <span className="text-slate-800 font-medium">{email}</span>
                        </p>
                      </div>

                      <OTPInput
                        value={code}
                        onChange={setCode}
                        disabled={status === "verifying"}
                        autoFocus
                      />

                      <div className="mt-5 h-5 text-center">
                        {status === "verifying" && (
                          <div className="flex items-center justify-center gap-2 text-blue-600 text-sm">
                            <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                            Vérification…
                          </div>
                        )}
                        {status === "error" && errorMsg && (
                          <p className="text-red-500 text-xs">{errorMsg}</p>
                        )}
                      </div>

                      <div className="mt-5 space-y-3">
                        <button
                          type="button"
                          onClick={resend}
                          disabled={resendIn > 0 || status === "verifying"}
                          className="w-full py-2.5 rounded-xl text-sm text-slate-500 hover:text-blue-600 disabled:opacity-50 disabled:hover:text-slate-500 transition-colors"
                        >
                          {resendIn > 0 ? `Renvoyer le code dans ${resendIn}s` : "Renvoyer le code"}
                        </button>
                        <button
                          type="button"
                          onClick={goBackToEmail}
                          className="w-full py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ArrowLeft size={14} /> Mauvais email ? Retour
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Final CTA banner ─────────────────────────────────────
function FinalCTABanner({ onCTA }: { onCTA: () => void }) {
  return (
    <section className="py-24 px-5">
      <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl mx-auto rounded-3xl p-12 text-center relative overflow-hidden" style={{ background: "linear-gradient(145deg, #1D4ED8 0%, #2563EB 40%, #4F46E5 100%)" }}>
        <div className="absolute inset-0 rounded-3xl" style={{ background: "radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)" }} />
        <div className="relative">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Chaque jour sans YIELD<br />
            <span className="text-blue-200">est un jour à perte nette</span>
          </h2>
          <p className="text-blue-200 mb-8 max-w-md mx-auto">Rejoignez 120+ chefs qui pilotent leur rendement en temps réel. Démarrez en 2 minutes.</p>
          <button onClick={onCTA} className="bg-white text-blue-700 font-bold px-10 py-4 rounded-2xl text-base inline-flex items-center gap-2.5 group shadow-glass hover:shadow-card-hover transition-all hover:-translate-y-0.5">
            Démarrer YIELD gratuitement
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </motion.div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-slate-100 py-10 px-5 bg-white/50">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <ChefHat size={15} className="text-blue-600" />
          <span className="font-black gradient-text">YIELD</span>
          <span className="text-slate-200">·</span>
          <span>Par des chefs, pour des chefs</span>
        </div>
        <div className="flex gap-6">
          {["CGU", "Confidentialité", "Contact"].map(link => (
            <a key={link} href="#" className="hover:text-slate-700 transition-colors">{link}</a>
          ))}
        </div>
        <p>© 2026 YIELD. Tous droits réservés.</p>
      </div>
    </footer>
  );
}

// ─── Auto-redirect si session active ─────────────────────
function useAuthRedirect() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/dashboard");
      } else {
        setChecking(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/dashboard");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  return checking;
}

// ─── Page ─────────────────────────────────────────────────
export default function LandingPage() {
  const [showCTA, setShowCTA] = useState(false);
  const checking = useAuthRedirect();

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F9FF" }}>
        <div className="w-10 h-10 rounded-2xl btn-primary flex items-center justify-center animate-pulse">
          <ChefHat size={18} className="text-white" />
        </div>
      </div>
    );
  }

  return (
    <>
      <ShaderBackground />
      <Nav onCTA={() => setShowCTA(true)} />
      <main>
        <HeroSection onCTA={() => setShowCTA(true)} />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <StatsSection />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <HowItWorksSection />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <ROISection />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <BenefitsSection />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <TestimonialsSection />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <StorySection />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <SecuritySection />
        <FinalCTABanner onCTA={() => setShowCTA(true)} />
      </main>
      <Footer />
      <CTASection show={showCTA} onClose={() => setShowCTA(false)} />
      <ConciergeButton />
    </>
  );
}
