"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Camera, Zap, Bell, ShieldCheck, TrendingDown,
  ChefHat, Lock, Server, ArrowRight, ArrowLeft,
  CheckCircle2, Menu, X, Scale, Timer, MessageCircle, KeyRound,
  Salad, Sliders,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PhoneShowcase } from "./components/PhoneShowcase";
import { supabase } from "@/lib/supabase-browser";

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
          <a href="#recettes" className="hover:text-slate-900 transition-colors">Mes Recettes</a>
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
              <a href="#recettes" onClick={() => setMobileOpen(false)}>Mes Recettes</a>
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
          La marge sous contrôle. En 30 secondes.
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
          et vous alerte avant que votre food cost ne s&apos;envole.
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
      </motion.div>

      {/* Showcase iPhone animé — sorti du max-w-4xl pour profiter de la
          largeur 2-col (caption à gauche, phone à droite sur desktop). */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="w-full mt-20"
      >
        <PhoneShowcase />
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
      title: "Alerte marge si la variation dépasse 3%",
      subtitle: "Votre food cost protégé en temps réel",
      description: "Dès qu'un prix matière dépasse le seuil, YIELD calcule l'impact net sur chaque fiche technique. Vous ajustez votre carte avant le prochain coup de feu.",
      detail: "Visualisez quelles fiches techniques sont impactées et de combien de points.",
      mockup: <AlertMockup />,
    },
    {
      number: "04", Icon: ChefHat,
      title: "Pilotez vos marges plat par plat",
      subtitle: "Le module Mes Recettes en accès libre",
      description: "Composez vos plats dans la calculatrice, liez chaque ingrédient à votre catalogue. À chaque scan, le coût matière est recalculé. Vous voyez en un coup d'œil quels plats glissent sous votre seuil de marge.",
      detail: "Simulateur de portion intégré : tester 180g de frites au lieu de 200g sans toucher au prix client, en 3 secondes.",
      mockup: <RecipesMockup />,
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
        <div className="btn-primary w-full text-center text-xs py-2.5 rounded-xl">3 alertes marge générées</div>
      </div>
    </div>
  );
}

function AlertMockup() {
  return (
    <div className="w-72 space-y-3">
      {[
        { product: "Filet de saumon", change: "+14.2%", recipes: "Tartare, Pavé grillé", impact: "−3.2 pts de marge" },
        { product: "Huile d'olive AOP", change: "+5.1%", recipes: "Salade, Pasta", impact: "−0.9 pts de marge" },
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

function RecipesMockup() {
  // 3 recettes mockées pour montrer en un coup d'œil le triage par santé
  // (rouge = critique, ambre = à surveiller, vert = sain). C'est exactement
  // l'écran que voit le chef dans /dashboard/recipes après quelques scans.
  const dishes = [
    { name: "Tartare de bœuf", margin: 68, drift: +9, tone: "rose" },
    { name: "Pavé de saumon", margin: 73, drift: +4, tone: "amber" },
    { name: "Frites maison", margin: 81, drift: -1, tone: "emerald" },
  ];
  const toneClasses = (t: string) => {
    if (t === "rose") return { bar: "bg-rose-400", text: "text-rose-600", chip: "bg-rose-50 text-rose-600 border-rose-100" };
    if (t === "amber") return { bar: "bg-amber-400", text: "text-amber-600", chip: "bg-amber-50 text-amber-700 border-amber-100" };
    return { bar: "bg-emerald-400", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-600 border-emerald-100" };
  };
  return (
    <div className="w-72 card rounded-2xl overflow-hidden shadow-card">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Salad size={14} className="text-emerald-600" />
          <span className="text-xs font-semibold text-slate-700">Mes recettes</span>
        </div>
        <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md">
          1 critique
        </span>
      </div>
      <div className="p-3 space-y-2">
        {dishes.map((d, i) => {
          const c = toneClasses(d.tone);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border border-slate-100 bg-white p-2.5 flex items-center gap-2.5"
            >
              <div className={`w-1 self-stretch rounded-full ${c.bar}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{d.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md border ${c.chip}`}>
                    Marge {d.margin}%
                  </span>
                  <span className={`text-[10px] font-semibold tabular-nums ${c.text}`}>
                    {d.drift > 0 ? "+" : ""}{d.drift}%
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="px-3 pb-3">
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 flex items-center gap-2">
          <Sliders size={12} className="text-blue-600 flex-shrink-0" />
          <span className="text-[11px] text-slate-600 leading-tight">
            Simulez 180g au lieu de 200g pour ramener la marge dans le vert.
          </span>
        </div>
      </div>
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
          className="text-center mb-12"
        >
          <p className="text-blue-600 uppercase tracking-widest text-xs font-semibold mb-3">Retour sur investissement</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            En 3 scans,{" "}
            <span className="gradient-text">YIELD est rentabilisé.</span>
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Abonnement YIELD : 19,99 € HT/mois. Économies récupérées lors des 3 premiers scans :{" "}
            <span className="font-semibold text-slate-700">153 €/mois</span> — soit près de 8× le coût de l&apos;abonnement.
          </p>
        </motion.div>

        {/* Badge "simulation" — ancrage explicite des chiffres dans une
            hypothèse de calcul. Plus honnête qu'un chiffre balancé sans contexte. */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Simulation typique — Brasserie 500 k€ CA, 3 livraisons / semaine
          </div>
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

        {/* Card de garantie — claim simple et honnête, mise en avant.
            On a retiré "ROI 60×" et "1 247 €/mois économies" qui n'étaient
            pas étayés par des données réelles (lancement, 0 client). */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl p-10 text-center relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #EFF6FF 0%, #DBEAFE 100%)" }}
        >
          <div aria-hidden className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-blue-200/40 blur-2xl" />
          <div className="relative">
            <p className="text-blue-700 uppercase tracking-widest text-xs font-bold mb-3">Notre promesse</p>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 leading-tight">
              Rentabilité garantie<br className="md:hidden" />
              {" "}ou <span className="gradient-text">remboursé.</span>
            </h3>
            <p className="text-slate-600 max-w-xl mx-auto leading-relaxed mb-2">
              Si YIELD ne vous fait pas économiser plus que son coût dès le premier mois,
              on vous rembourse intégralement. Aucune question, aucune justification.
            </p>
            <p className="text-slate-500 text-sm">
              Abonnement <strong className="text-slate-900">19,99 € HT/mois</strong> · Sans engagement · Résiliable en 1 clic
            </p>
          </div>
        </motion.div>

        {/* Teaser Pro à venir — annonce honnête sans CTA Stripe (pas encore wired). */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <div className="flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                Bientôt
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-slate-900 font-bold text-base mb-1">
                Forfait Pro — 39,99 € HT/mois
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Scans illimités, espace comptable (export Sage, EBP, Cegid), suivi des écarts
                fournisseur multi-établissements et accès API. Pour les groupes et restaurants à fort volume.
              </p>
            </div>
            <a
              href="mailto:lucasyieldapp@gmail.com?subject=Liste%20d'attente%20Forfait%20Pro&body=Bonjour%20Lucas%2C%20je%20suis%20int%C3%A9ress%C3%A9%20par%20le%20futur%20forfait%20Pro%20de%20Yield."
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm font-semibold transition-colors whitespace-nowrap"
            >
              Me prévenir
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Benefits ─────────────────────────────────────────────
function BenefitsSection() {
  return (
    <section id="benefices" className="py-24 px-5">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-blue-600 uppercase tracking-widest text-xs font-semibold mb-3">Le quotidien d&apos;un chef</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            Hier sans YIELD.<br />
            <span className="gradient-text">Aujourd&apos;hui avec.</span>
          </h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-6"
        >
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
                "Votre marge reste sous contrôle 24h/24",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-slate-700 text-sm">
                  <CheckCircle2 size={14} className="text-blue-500 flex-shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
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
              <p className="text-slate-400 text-xs">Conçu par d&apos;anciens cuisiniers pour les restaurateurs</p>
            </div>
          </div>
          <blockquote className="text-slate-800 text-xl md:text-2xl font-medium leading-relaxed mb-6">
            On a bouclé des fins de service à{" "}
            <span className="gradient-text font-bold">2h du matin</span>, calculette à la main, à comprendre pourquoi le mois avait fondu. La volaille avait pris 14% en douce. Le saumon, 9%. Personne ne prévient. On l&apos;a vécu.
          </blockquote>
          <p className="text-slate-500 leading-relaxed mb-4">
            On a construit YIELD pour que plus jamais un chef ne serve à perte sans le savoir. Pas un logiciel de gestion, pas un ERP. Juste : une photo du BL, une alerte si ça dérive. Rien à apprendre, rien à configurer.
          </p>
          <p className="text-slate-500 leading-relaxed">
            Aujourd&apos;hui, pendant que vous dressez, que vous gérez la salle, que vous formez vos commis, YIELD lit vos livraisons et veille sur votre marge. Silencieusement.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────
// 4 objections fréquentes des chefs avant d'essayer, avec réponses courtes
// et honnêtes. Placée juste avant le CTA final pour lever les dernières
// hésitations.
function FAQSection() {
  const items = [
    {
      q: "Et si l'IA se trompe en lisant mon BL ?",
      a: "Chaque ligne est éditable en 1 clic depuis la facture. L'IA atteint une précision élevée sur les BL imprimés et manuscrits, mais c'est vous qui gardez la main : si elle lit \"15,20\" au lieu de \"15,02\", vous corrigez et l'historique reste juste.",
    },
    {
      q: "Combien de temps ça prend par jour ?",
      a: "Une photo du BL à réception, soit 5 secondes. L'analyse tourne en arrière-plan, vous n'attendez pas. Rien à classer, rien à ressaisir. Si vous avez 3 livraisons par semaine, c'est 1 minute hebdo total.",
    },
    {
      q: "Et si je veux résilier ?",
      a: "Résiliation en 1 clic depuis le portail Stripe, à tout moment. Aucune relance, aucune justification. Vous exportez vos données quand vous voulez (CSV pour votre comptable, PDF pour vos archives). Aucune revente, jamais.",
    },
    {
      q: "Mes BL contiennent des informations sensibles. Vous en faites quoi ?",
      a: "Stockage chiffré (AES-256) sur serveurs en France. Aucun partage avec qui que ce soit, jamais. Suppression totale sur simple demande sous 48h. Compatible RGPD natif. Vos données sont entre vos mains — et seulement les vôtres.",
    },
  ];

  return (
    <section className="py-24 px-5">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-blue-600 uppercase tracking-widest text-xs font-semibold mb-3">Questions fréquentes</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            Ce que les chefs nous{" "}
            <span className="gradient-text">demandent.</span>
          </h2>
        </motion.div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <motion.details
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group card rounded-2xl border border-slate-100 overflow-hidden"
            >
              <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                <span className="text-slate-900 font-semibold text-sm md:text-base">{item.q}</span>
                <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 group-open:rotate-45 transition-transform duration-300">
                  <span className="text-lg leading-none font-light">+</span>
                </span>
              </summary>
              <div className="px-5 pb-5 -mt-1">
                <p className="text-slate-500 text-sm leading-relaxed">{item.a}</p>
              </div>
            </motion.details>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center text-slate-400 text-sm mt-8"
        >
          Une autre question ?{" "}
          <a
            href="mailto:lucasyieldapp@gmail.com"
            className="text-blue-600 font-semibold hover:underline"
          >
            Écrivez à Lucas, fondateur
          </a>
        </motion.p>
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
              href="mailto:chef@yieldapp.fr"
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
// Normalisation agressive : NFKC (caractères composés), retrait des
// invisibles Unicode, retrait de TOUS les espaces (un email n'en contient pas),
// lowercase final. Utilisée à l'envoi ET à la vérif pour garantir l'identité.
function normalizeEmail(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[​-‍﻿ ]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function CTASection({ show, onClose }: { show: boolean; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "verifying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendIn, setResendIn] = useState(0);

  // ⭐ LOCK email — figé entre signInWithOtp et verifyOtp, hors cycle React
  const lockedEmailRef = useRef<string>("");

  // ⭐ LOCKS anti-double-call — synchrones (refs), donc immunes aux re-renders
  // de React 18 et au double-mount de StrictMode. Une promesse en cours n'est
  // jamais relancée tant qu'elle n'est pas terminée.
  const sendingRef = useRef(false);
  const verifyingRef = useRef(false);
  // Mémorise quels tokens ont déjà été envoyés à verifyOtp pour ce code email.
  // Évite un 2e appel sur un token déjà brûlé (cause classique du "expired" instantané).
  const verifiedTokensRef = useRef<Set<string>>(new Set());

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
        lockedEmailRef.current = "";
        sendingRef.current = false;
        verifyingRef.current = false;
        verifiedTokensRef.current = new Set();
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
    if (sendingRef.current) return; // ⭐ anti-double-click
    sendingRef.current = true;
    const normalized = normalizeEmail(emailToUse);
    setStatus("sending");
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: { shouldCreateUser: true },
      });
      if (error) {
        setStatus("error");
        const m = error.message.toLowerCase();
        if (m.includes("rate") || m.includes("too many")) {
          setErrorMsg("Trop d'envois récents. Patientez 60 secondes.");
        } else if (m.includes("invalid email") || m.includes("email")) {
          setErrorMsg("Adresse email invalide ou refusée par le serveur.");
        } else {
          setErrorMsg(`Envoi impossible : ${error.message}`);
        }
        return;
      }
      // Lock + persist la version normalisée
      lockedEmailRef.current = normalized;
      verifiedTokensRef.current = new Set(); // nouveau code → on oublie les tokens précédents
      setEmail(normalized);
      setStep("code");
      setStatus("idle");
      setResendIn(30);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? `Réseau : ${err.message}` : "Erreur réseau lors de l'envoi.");
    } finally {
      sendingRef.current = false;
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sendingRef.current || status === "sending") return; // ⭐ anti-double-submit
    const normalized = normalizeEmail(email);
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setErrorMsg("Adresse email invalide");
      setStatus("error");
      return;
    }
    sendCode(normalized);
  };

  const verifyCode = async (rawToken: string) => {
    if (verifyingRef.current) return; // ⭐ anti-double-call (cause root du "expiré instantané")
    const token = rawToken.replace(/\D/g, "").trim();
    if (token.length !== 6) return;
    if (verifiedTokensRef.current.has(token)) {
      // Déjà tenté → on ne re-tape PAS sur Supabase (qui répondrait "expiré/consommé")
      return;
    }

    const verifyEmail = lockedEmailRef.current || normalizeEmail(email);
    if (!verifyEmail) {
      setStatus("error");
      setErrorMsg("Session perdue. Recommencez depuis l'email.");
      return;
    }

    verifyingRef.current = true;
    verifiedTokensRef.current.add(token);
    setStatus("verifying");
    setErrorMsg("");

    try {
      // Tentative 1 — type "email" (standard Supabase v2 pour signInWithOtp)
      let result = await supabase.auth.verifyOtp({
        email: verifyEmail,
        token,
        type: "email",
      });

      // Fallback type "signup" si invalid token (couvre certains cas shouldCreateUser)
      if (result.error) {
        const msg = result.error.message.toLowerCase();
        const isInvalid = msg.includes("invalid") || msg.includes("token");
        const isExpired = msg.includes("expired") || msg.includes("expire");
        if (isInvalid && !isExpired) {
          const retry = await supabase.auth.verifyOtp({
            email: verifyEmail,
            token,
            type: "signup",
          });
          result = retry;
        }
      }

      if (result.error) {
        const msg = result.error.message.toLowerCase();
        const httpStatus = (result.error as { status?: number })?.status;
        setStatus("error");
        // ⭐ Diagnostic plus fin pour différencier expiration vs réseau vs token consommé
        if (msg.includes("expired") || msg.includes("expire")) {
          setErrorMsg("Le code a expiré (validité 1 heure). Demandez-en un nouveau.");
        } else if (msg.includes("rate") || msg.includes("too many") || httpStatus === 429) {
          setErrorMsg("Trop de tentatives. Patientez avant de réessayer.");
        } else if (msg.includes("network") || msg.includes("fetch") || httpStatus === 0 || (httpStatus !== undefined && httpStatus >= 500)) {
          setErrorMsg(`Erreur réseau (${httpStatus ?? "no status"}). Vérifiez votre connexion et réessayez.`);
        } else if (msg.includes("invalid") || msg.includes("token")) {
          setErrorMsg("Code refusé : 6 chiffres incorrects ou code déjà utilisé. Demandez-en un nouveau.");
        } else {
          setErrorMsg(`Échec : ${result.error.message}`);
        }
        setCode("");
        return;
      }

      setStatus("success");
      setTimeout(() => router.replace("/dashboard"), 400);
    } catch (err) {
      // Erreurs JS (réseau, timeout, parse) — toujours différentiées d'une vraie expiration
      setStatus("error");
      setErrorMsg(
        err instanceof Error
          ? `Erreur réseau : ${err.message}. Vérifiez votre connexion et redemandez un code.`
          : "Erreur réseau inconnue. Vérifiez votre connexion."
      );
      setCode("");
    } finally {
      verifyingRef.current = false;
    }
  };

  // Auto-submit quand les 6 chiffres sont saisis (ref-guarded → 1 seul appel garanti)
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
    lockedEmailRef.current = "";
    verifiedTokensRef.current = new Set();
  };

  const resend = () => {
    if (resendIn > 0 || sendingRef.current) return;
    setCode("");
    sendCode(lockedEmailRef.current || email);
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
                        <fieldset disabled={status === "sending"} className="space-y-4 disabled:opacity-60 disabled:cursor-not-allowed">
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={e => { setEmail(e.target.value); if (status === "error") { setStatus("idle"); setErrorMsg(""); } }}
                            placeholder="votre@email.com"
                            autoComplete="email"
                            inputMode="email"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-100"
                          />
                          <button
                            type="submit"
                            disabled={status === "sending"}
                            aria-busy={status === "sending"}
                            className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait text-sm transition-all"
                          >
                            {status === "sending" ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="font-medium">Envoi du code en cours…</span>
                              </>
                            ) : (
                              <>Envoyer le code <ArrowRight size={16} /></>
                            )}
                          </button>
                        </fieldset>
                        {status === "error" && errorMsg && (
                          <p className="text-red-500 text-xs text-center leading-relaxed">{errorMsg}</p>
                        )}
                      </form>
                      <p className="text-center text-slate-400 text-xs mt-5">
                        En continuant, vous acceptez nos{" "}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">CGU</a> et notre{" "}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">politique de confidentialité</a>.
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
  // Trust strip — anciennes infos de SecuritySection condensées en 4 items
  // discrets sous le CTA principal. Rassure sans saouler.
  // Labels courts pour rentrer proprement en 2×2 sur mobile (sans wrap moche).
  const trustItems = [
    { Icon: Lock, label: "Chiffré AES-256" },
    { Icon: Server, label: "Hébergé en France" },
    { Icon: KeyRound, label: "Sans mot de passe" },
    { Icon: ShieldCheck, label: "RGPD natif" },
  ];

  return (
    <section className="py-24 px-5">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto rounded-3xl p-10 md:p-12 text-center relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #1D4ED8 0%, #2563EB 40%, #4F46E5 100%)" }}
      >
        <div className="absolute inset-0 rounded-3xl" style={{ background: "radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)" }} />
        <div className="relative">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            Chaque jour sans YIELD<br />
            <span className="text-blue-200">est un jour à perte nette</span>
          </h2>
          <p className="text-blue-200 mb-8 max-w-md mx-auto">
            Démarrez en 2 minutes. Sans carte bancaire. 14 jours d&apos;essai puis 19,99 € HT/mois.
          </p>
          <button
            onClick={onCTA}
            className="bg-white text-blue-700 font-bold px-10 py-4 rounded-2xl text-base inline-flex items-center gap-2.5 group shadow-glass hover:shadow-card-hover transition-all hover:-translate-y-0.5"
          >
            Démarrer YIELD gratuitement
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Trust strip — sécurité condensée sous le CTA.
              2×2 sur mobile (gap-y plus généreux), 4 cols sur desktop. */}
          <div className="mt-10 pt-8 border-t border-white/15 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5 md:gap-y-0 text-blue-100">
            {trustItems.map(({ Icon, label }) => (
              <div key={label} className="flex items-center justify-center gap-2 text-[12px] md:text-xs">
                <Icon size={15} className="text-blue-200 flex-shrink-0" />
                <span className="font-medium whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
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
          <a href="/terms" className="hover:text-slate-700 transition-colors">CGU</a>
          <a href="/privacy" className="hover:text-slate-700 transition-colors">Confidentialité</a>
          <a href="mailto:chef@yieldapp.fr" className="hover:text-slate-700 transition-colors">Contact</a>
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
  // Code parrain détecté dans l'URL ?ref=CODE → on affiche un banner top
  // pour rassurer le user : "Vous avez été parrainé, 30j offerts en plus".
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const checking = useAuthRedirect();

  // Capture du code parrain depuis l'URL (?ref=GERS-MARC) au 1er chargement.
  // Stocké en localStorage : sera appliqué après le signup quand le user a
  // un id et un profile en BDD. Survit aux navigations Safari (vs cookie HTTPOnly
  // qui pose problème en Safari ITP).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      const code = ref.trim().toUpperCase();
      localStorage.setItem("yield_pending_referral_code", code);
      setReferralCode(code);
    }
  }, []);

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
      {/* Banner parrainage — affiché si ?ref=CODE détecté dans l'URL.
          Fixe en haut, gradient emerald, dismissable (mais le code reste
          en localStorage et sera appliqué automatiquement après le signup). */}
      {referralCode && (
        <div
          className="fixed top-0 inset-x-0 z-[55] text-white text-center text-[13px] py-2.5 px-5 shadow-md"
          style={{ background: "linear-gradient(90deg, #059669 0%, #2563EB 100%)" }}
        >
          <span className="font-medium">
            🎁 Vous avez été parrainé — <strong>30 jours d&apos;essai gratuits</strong> seront
            activés à l&apos;inscription (au lieu de 14). Aucune carte bancaire requise.
          </span>
          <button
            onClick={() => setReferralCode(null)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-1"
            aria-label="Masquer"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <Nav onCTA={() => setShowCTA(true)} />
      <main>
        {/* Nouvelle composition resserrée pour un chef pressé entre 2 services :
            Hero → HowItWorks → Avant/Avec → ROI court → FAQ → Story → CTA final.
            Suppression de StatsSection, RecipesSection (redondant avec étape 04
            de HowItWorks), SecuritySection (compressée en trust strip). */}
        <HeroSection onCTA={() => setShowCTA(true)} />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <HowItWorksSection />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <BenefitsSection />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <ROISection />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <FAQSection />
        <div className="divider-gradient max-w-6xl mx-auto" />
        <StorySection />
        <FinalCTABanner onCTA={() => setShowCTA(true)} />
      </main>
      <Footer />
      <CTASection show={showCTA} onClose={() => setShowCTA(false)} />
      <ConciergeButton />
    </>
  );
}
