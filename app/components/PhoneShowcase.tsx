"use client";

// Maquette iPhone animée pour le hero de la home.
// 5 scènes qui s'enchaînent en boucle pour faire vivre le parcours produit :
// dashboard → tap scan → caméra → analyse IA → alerte recette.
//
// Démarre quand visible (IntersectionObserver), met en pause hors viewport,
// respecte prefers-reduced-motion pour les utilisateurs sensibles aux animations.
// Tout est CSS/SVG : aucune image, aucune dépendance externe.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Battery, Camera, ChefHat, ChevronRight, Salad, ScanLine, Signal, Sparkles,
  TrendingDown, TrendingUp, Wifi,
} from "lucide-react";

const SCENES = ["dashboard", "tap", "camera", "processing", "recipes"] as const;
type Scene = typeof SCENES[number];

// Durée de chaque scène (ms). Total boucle ≈ 13s.
const SCENE_DURATIONS: Record<Scene, number> = {
  dashboard: 3000,
  tap: 1400,
  camera: 2800,
  processing: 3200,
  recipes: 3400,
};

const SCENE_LABELS: Record<Scene, string> = {
  dashboard: "Votre cockpit",
  tap: "Un clic, un scan",
  camera: "Photographiez",
  processing: "L'IA lit en 30s",
  recipes: "Marges en temps réel",
};

// Caption complète affichée à gauche de l'iPhone, synchronisée avec la scène
// affichée. C'est ce qui rend le showcase auto-explicatif sans devoir lire le
// reste de la page.
const SCENE_CAPTIONS: Record<Scene, { step: string; title: string; body: string }> = {
  dashboard: {
    step: "01",
    title: "Votre cockpit, au réveil.",
    body: "En un coup d'œil, vous voyez vos marges du mois, vos alertes en cours et la santé de votre carte. Tout est calme — ou ça clignote.",
  },
  tap: {
    step: "02",
    title: "Un appui. Pas de tableur.",
    body: "Vous touchez « Scanner ». Pas de logiciel à apprendre, pas de menu caché. L'app est conçue pour le coup de feu, pas pour le bureau.",
  },
  camera: {
    step: "03",
    title: "Photographiez votre BL.",
    body: "Cadrez le bon de livraison comme une photo Instagram. À réception, en 5 secondes. Compatible Metro, Promocash, Transgourmet, PDF.",
  },
  processing: {
    step: "04",
    title: "L'IA lit en 30 secondes.",
    body: "Claude Vision extrait chaque ligne matière, compare avec vos prix historiques et détecte les hausses. Précision > 97%.",
  },
  recipes: {
    step: "05",
    title: "Vos plats. En temps réel.",
    body: "Dès qu'un fournisseur augmente, vos recettes glissent du vert au rouge. Vous ajustez la portion ou le prix avant le prochain service.",
  },
};

export function PhoneShowcase() {
  const [scene, setScene] = useState<Scene>("dashboard");
  const [active, setActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active la boucle quand visible. Pause quand hors écran (économie batterie).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => setActive(entries[0]?.isIntersecting ?? false),
      { threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Respect prefers-reduced-motion : si l'user a coché "réduire les animations",
  // on fige sur la scène dashboard sans cycler.
  useEffect(() => {
    if (!active) return;
    if (typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const t = window.setTimeout(() => {
      const idx = SCENES.indexOf(scene);
      const next = SCENES[(idx + 1) % SCENES.length];
      setScene(next);
    }, SCENE_DURATIONS[scene]);
    return () => window.clearTimeout(t);
  }, [scene, active]);

  const caption = SCENE_CAPTIONS[scene];
  const idx = SCENES.indexOf(scene);

  return (
    <div
      ref={containerRef}
      className="relative grid md:grid-cols-[1fr_auto] gap-10 md:gap-16 items-center max-w-5xl mx-auto"
    >
      {/* ── Caption panel (gauche desktop, sous phone mobile) ── */}
      <div className="order-2 md:order-1 text-center md:text-left max-w-md md:max-w-none mx-auto md:mx-0 md:pr-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={scene}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="text-blue-600 font-mono text-xs font-bold tracking-widest">
                {caption.step} / 05
              </span>
              <span className="text-blue-300">·</span>
              <span className="text-blue-600 text-xs font-semibold uppercase tracking-wider">
                {SCENE_LABELS[scene]}
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight mb-3 tracking-tight">
              {caption.title}
            </h3>
            <p className="text-slate-500 text-sm md:text-base leading-relaxed">
              {caption.body}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress bar globale */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              key={scene + "-bar"}
              initial={{ width: "0%" }}
              animate={active ? { width: "100%" } : { width: "0%" }}
              transition={{ duration: SCENE_DURATIONS[scene] / 1000, ease: "linear" }}
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
            />
          </div>
          <span className="text-slate-400 font-mono text-xs tabular-nums">
            {String(idx + 1).padStart(2, "0")}/{String(SCENES.length).padStart(2, "0")}
          </span>
        </div>

        {/* Step pills cliquables (saut direct à une scène) */}
        <div className="mt-4 flex items-center gap-1.5 justify-center md:justify-start">
          {SCENES.map((s) => (
            <button
              key={s}
              onClick={() => setScene(s)}
              aria-label={`Voir l'étape ${SCENE_LABELS[s]}`}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                s === scene
                  ? "w-10 bg-blue-500"
                  : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Phone (droite desktop, en haut mobile) ── */}
      <div className="order-1 md:order-2 relative flex justify-center">
        {/* Glow décoratif derrière le phone */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none"
        >
          <div className="w-[360px] h-[360px] rounded-full bg-blue-500/15 blur-[80px] animate-pulse-slow" />
        </div>

        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          className="relative"
        >
          <PhoneFrame>
            <AnimatePresence mode="wait">
              {scene === "dashboard" && <SceneDashboard key="dashboard" />}
              {scene === "tap" && <SceneTap key="tap" />}
              {scene === "camera" && <SceneCamera key="camera" />}
              {scene === "processing" && <SceneProcessing key="processing" />}
              {scene === "recipes" && <SceneRecipes key="recipes" />}
            </AnimatePresence>
          </PhoneFrame>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Châssis iPhone (CSS pure, pas d'image) ──────────────────────────────────
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative mx-auto"
      style={{ width: 300, height: 612 }}
    >
      {/* Reflection sous le téléphone — donne du volume */}
      <div
        aria-hidden
        className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-56 h-12 bg-slate-900/15 rounded-full blur-2xl"
      />

      {/* Bezel externe (couleur titanium/noir) */}
      <div
        className="absolute inset-0 rounded-[48px] shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #1a1a1d 0%, #2a2a2e 40%, #18181b 100%)",
          boxShadow: "0 30px 60px -15px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255,255,255,0.05) inset",
        }}
      >
        {/* Reflet bord brillant — détail premium */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-[48px] pointer-events-none"
          style={{
            background: "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)",
          }}
        />
      </div>

      {/* Boutons latéraux — petits détails de réalisme */}
      <div className="absolute left-[-2px] top-[100px] w-[3px] h-8 bg-slate-700 rounded-l-sm" />
      <div className="absolute left-[-2px] top-[145px] w-[3px] h-14 bg-slate-700 rounded-l-sm" />
      <div className="absolute left-[-2px] top-[210px] w-[3px] h-14 bg-slate-700 rounded-l-sm" />
      <div className="absolute right-[-2px] top-[160px] w-[3px] h-20 bg-slate-700 rounded-r-sm" />

      {/* Écran (inset 9px = épaisseur du bezel) */}
      <div
        className="absolute overflow-hidden bg-[#F7F9FF]"
        style={{
          top: 9, bottom: 9, left: 9, right: 9,
          borderRadius: 40,
        }}
      >
        {/* Dynamic Island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-30" />

        {/* Status bar */}
        <div className="absolute top-2.5 inset-x-0 z-20 flex items-center justify-between px-6 pointer-events-none">
          <span className="text-[10px] font-bold tabular-nums text-slate-900">9:41</span>
          <div className="flex items-center gap-1 text-slate-900">
            <Signal size={10} strokeWidth={2.5} />
            <Wifi size={10} strokeWidth={2.5} />
            <Battery size={13} strokeWidth={2} className="rotate-0" />
          </div>
        </div>

        {/* Contenu scène (offset top pour la status bar) */}
        <div className="absolute inset-0 pt-10 pb-6">
          {children}
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-slate-900/80 rounded-full z-30" />
      </div>
    </div>
  );
}

// Transition partagée par toutes les scènes pour une cohérence visuelle.
// Adoucie : fade prédominant + léger scale, plus de slide horizontal qui
// faisait sortir le contenu du cadre pendant la transition.
const sceneAnim = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

// ─── Scène 1 : Dashboard ─────────────────────────────────────────────────────
function SceneDashboard() {
  return (
    <motion.div {...sceneAnim} className="px-3.5 h-full flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <ChefHat size={10} className="text-white" />
          </div>
          <span className="text-[10px] font-black tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">YIELD</span>
        </div>
        <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-[8px] font-bold text-blue-700">2</span>
        </div>
      </div>

      {/* Salutation */}
      <div>
        <p className="text-[13px] font-bold text-slate-900 leading-tight">Bonjour Chef 👋</p>
        <p className="text-[9px] text-slate-400">2 alertes à examiner</p>
      </div>

      {/* KPI strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl bg-white border border-slate-100 px-2 py-1.5 grid grid-cols-3 gap-1 shadow-sm"
      >
        <div className="text-center">
          <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Total HT</p>
          <p className="text-[11px] font-bold tabular-nums leading-tight">3 247 €</p>
        </div>
        <div className="text-center border-x border-slate-100">
          <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Variation</p>
          <p className="text-[11px] font-bold text-rose-600 tabular-nums leading-tight">+8,2%</p>
        </div>
        <div className="text-center">
          <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Alertes</p>
          <p className="text-[11px] font-bold text-rose-600 leading-tight">2</p>
        </div>
      </motion.div>

      {/* Hero cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-1.5"
      >
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-2 text-white shadow-md relative overflow-hidden">
          <div aria-hidden className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white/10 blur-md" />
          <Camera size={12} className="mb-1 relative" />
          <p className="text-[7px] font-bold opacity-80 tracking-wider relative">LE MOTEUR</p>
          <p className="text-[10px] font-bold leading-tight relative">Scanner une facture</p>
        </div>
        <div className="rounded-xl bg-white border border-emerald-100 p-2 shadow-sm">
          <ChefHat size={12} className="mb-1 text-emerald-700" />
          <p className="text-[7px] font-bold text-emerald-700 tracking-wider">LE PILOTE</p>
          <p className="text-[10px] font-bold text-slate-900 leading-tight">Mes recettes</p>
        </div>
      </motion.div>

      {/* Carte santé */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-rose-200 bg-rose-50/60 p-2 flex items-center gap-1.5"
      >
        <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center flex-shrink-0">
          <Salad size={11} className="text-rose-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[7px] text-slate-500 font-bold uppercase tracking-wider">Santé carte</p>
          <p className="text-[9px] font-bold text-rose-700 leading-tight">2 plats à surveiller</p>
        </div>
        <ChevronRight size={10} className="text-slate-400" />
      </motion.div>

      {/* Liste factures */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex-1 space-y-1 overflow-hidden"
      >
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Récents</p>
        {[
          { name: "Metro Cash & Carry", time: "Aujourd'hui, 14:30", amt: "847,20 €", chg: "+8,2%", bad: true },
          { name: "Transgourmet", time: "Hier, 10:15", amt: "412,50 €", chg: "−1,2%", bad: false },
        ].map((f, i) => (
          <div key={i} className="rounded-lg bg-white border border-slate-100 p-1.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-slate-900 truncate leading-tight">{f.name}</p>
              <p className="text-[7px] text-slate-400">{f.time}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold tabular-nums leading-tight">{f.amt}</p>
              <p className={`text-[7px] font-bold tabular-nums ${f.bad ? "text-rose-600" : "text-emerald-600"}`}>{f.chg}</p>
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ─── Scène 2 : Tap (ghost finger sur le bouton Scanner) ──────────────────────
function SceneTap() {
  return (
    <motion.div {...sceneAnim} className="px-3.5 h-full flex flex-col gap-2 relative">
      {/* Reprise du dashboard figé */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <ChefHat size={10} className="text-white" />
          </div>
          <span className="text-[10px] font-black tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">YIELD</span>
        </div>
        <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-[8px] font-bold text-blue-700">2</span>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold text-slate-900 leading-tight">Bonjour Chef 👋</p>
        <p className="text-[9px] text-slate-400">2 alertes à examiner</p>
      </div>

      <div className="rounded-xl bg-white border border-slate-100 px-2 py-1.5 grid grid-cols-3 gap-1 shadow-sm opacity-60">
        <div className="text-center">
          <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Total HT</p>
          <p className="text-[11px] font-bold tabular-nums leading-tight">3 247 €</p>
        </div>
        <div className="text-center border-x border-slate-100">
          <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Variation</p>
          <p className="text-[11px] font-bold text-rose-600 tabular-nums leading-tight">+8,2%</p>
        </div>
        <div className="text-center">
          <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Alertes</p>
          <p className="text-[11px] font-bold text-rose-600 leading-tight">2</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 relative">
        {/* Carte scanner en avant + cercle tap */}
        <motion.div
          animate={{ scale: [1, 0.97, 1] }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-2 text-white shadow-lg relative overflow-hidden ring-2 ring-blue-400 ring-offset-2 ring-offset-[#F7F9FF]"
        >
          <div aria-hidden className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white/10 blur-md" />
          <Camera size={12} className="mb-1 relative" />
          <p className="text-[7px] font-bold opacity-80 tracking-wider relative">LE MOTEUR</p>
          <p className="text-[10px] font-bold leading-tight relative">Scanner une facture</p>

          {/* Ghost tap : cercles concentriques qui pulsent */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.4], opacity: [0.7, 0] }}
            transition={{ duration: 0.9, repeat: 1, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-2 border-white pointer-events-none"
          />
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.1], opacity: [0.9, 0] }}
            transition={{ duration: 0.9, repeat: 1, delay: 0.15, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/30 pointer-events-none"
          />
        </motion.div>
        <div className="rounded-xl bg-white border border-emerald-100 p-2 shadow-sm opacity-50">
          <ChefHat size={12} className="mb-1 text-emerald-700" />
          <p className="text-[7px] font-bold text-emerald-700 tracking-wider">LE PILOTE</p>
          <p className="text-[10px] font-bold text-slate-900 leading-tight">Mes recettes</p>
        </div>
      </div>

      {/* Doigt symbolique */}
      <motion.div
        initial={{ x: 10, y: 60, opacity: 0 }}
        animate={{ x: 0, y: 50, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.35 }}
        className="absolute top-[210px] left-[60px] z-10 pointer-events-none"
      >
        <div className="w-7 h-7 rounded-full bg-slate-900 shadow-lg flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-slate-100" />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Scène 3 : Caméra (viewfinder) ───────────────────────────────────────────
function SceneCamera() {
  return (
    <motion.div {...sceneAnim} className="h-full bg-slate-950 relative overflow-hidden">
      {/* Fond légèrement structuré pour simuler la caméra */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />

      {/* Header caméra */}
      <div className="absolute top-3 inset-x-0 px-4 flex items-center justify-between text-white z-10">
        <span className="text-[10px] font-semibold">Annuler</span>
        <span className="text-[10px] font-semibold opacity-70">Bon de livraison</span>
        <span className="text-[10px] font-semibold opacity-0">Annuler</span>
      </div>

      {/* Viewfinder : 4 coins de cadrage */}
      <div className="absolute inset-x-6 top-12 bottom-24 rounded-lg">
        {[
          "top-0 left-0 border-t-2 border-l-2 rounded-tl-md",
          "top-0 right-0 border-t-2 border-r-2 rounded-tr-md",
          "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md",
          "bottom-0 right-0 border-b-2 border-r-2 rounded-br-md",
        ].map((cls, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className={`absolute w-6 h-6 border-white ${cls}`}
          />
        ))}

        {/* BL papier qui apparaît dans le cadre */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="absolute inset-3 bg-white rounded-md p-2.5 shadow-2xl"
        >
          {/* Header du BL */}
          <div className="border-b border-slate-200 pb-1 mb-1.5">
            <p className="text-[7px] font-bold text-slate-700">METRO CASH &amp; CARRY</p>
            <p className="text-[6px] text-slate-400">BL n° 2024-08847</p>
          </div>
          {/* Lignes du BL */}
          <div className="space-y-0.5">
            {[78, 65, 82, 58, 70, 60, 73].map((w, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="h-[3px] bg-slate-200 rounded" style={{ width: `${w * 0.5}%` }} />
                <div className="h-[3px] bg-slate-300 rounded w-6 ml-auto" />
              </div>
            ))}
          </div>
          {/* Ligne de scan animée */}
          <motion.div
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: [0, 90, 0], opacity: [0, 1, 0] }}
            transition={{ delay: 1, duration: 2, ease: "easeInOut" }}
            className="absolute inset-x-2 top-2 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_10px_2px_rgba(59,130,246,0.6)]"
          />
        </motion.div>
      </div>

      {/* Label centre */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="absolute bottom-32 inset-x-0 text-center text-white/70 text-[10px] font-medium"
      >
        Cadrez votre BL
      </motion.p>

      {/* Bouton shutter */}
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-14 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full border-[3px] border-white flex items-center justify-center"
      >
        <div className="w-9 h-9 rounded-full bg-white" />
      </motion.div>
    </motion.div>
  );
}

// ─── Scène 4 : Analyse IA en cours ───────────────────────────────────────────
function SceneProcessing() {
  const lines = [
    { name: "Filet de saumon", prev: "16,20 €", curr: "18,50 €", chg: "+14,2%", bad: true },
    { name: "Tomates cerises", prev: "3,10 €", curr: "3,20 €", chg: "+3,2%", bad: true },
    { name: "Huile olive AOP", prev: "27,50 €", curr: "28,90 €", chg: "+5,1%", bad: true },
    { name: "Beurre AOP 82%", prev: "4,80 €", curr: "4,75 €", chg: "−1,0%", bad: false },
  ];
  return (
    <motion.div {...sceneAnim} className="px-3.5 h-full flex flex-col gap-2">
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <ChefHat size={10} className="text-white" />
          </div>
          <span className="text-[10px] font-black tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">YIELD</span>
        </div>
      </div>

      {/* Header analyse */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-white border border-blue-100 p-2.5 shadow-sm"
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[9px] font-bold text-slate-700">Metro Cash &amp; Carry</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={10} className="text-blue-500" />
          <p className="text-[10px] font-bold text-slate-900 leading-tight">Lecture matière en cours…</p>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.4, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[7px] text-slate-400 uppercase font-semibold tracking-wider">Analyse Claude Vision</p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="text-[7px] text-emerald-600 font-bold"
          >
            12 lignes
          </motion.p>
        </div>
      </motion.div>

      {/* Lignes qui apparaissent */}
      <div className="space-y-1 flex-1">
        {lines.map((l, i) => (
          <motion.div
            key={l.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.35, duration: 0.3 }}
            className="rounded-lg bg-white border border-slate-100 p-1.5 flex items-center gap-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-slate-800 truncate leading-tight">{l.name}</p>
              <p className="text-[7px] text-slate-400 tabular-nums leading-tight">{l.prev} → {l.curr}</p>
            </div>
            <span className={`text-[8px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
              l.bad ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
            }`}>
              {l.chg}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Footer alerte */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2 }}
        className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 p-2 text-white text-center shadow-md"
      >
        <p className="text-[10px] font-bold">3 alertes rendement générées</p>
      </motion.div>
    </motion.div>
  );
}

// ─── Scène 5 : Mes Recettes avec drift live ──────────────────────────────────
function SceneRecipes() {
  const dishes = [
    { name: "Tartare de bœuf", marge: 68, drift: +9, tone: "rose" as const },
    { name: "Pavé de saumon", marge: 73, drift: +4, tone: "amber" as const },
    { name: "Frites maison", marge: 81, drift: -1, tone: "emerald" as const },
    { name: "Crème brûlée", marge: 77, drift: 0, tone: "emerald" as const },
  ];
  const tones = {
    rose: { bar: "bg-rose-400", text: "text-rose-700", chip: "bg-rose-50 text-rose-700 border-rose-100", drift: "text-rose-600" },
    amber: { bar: "bg-amber-400", text: "text-amber-700", chip: "bg-amber-50 text-amber-700 border-amber-100", drift: "text-amber-600" },
    emerald: { bar: "bg-emerald-400", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700 border-emerald-100", drift: "text-emerald-600" },
  };
  return (
    <motion.div {...sceneAnim} className="px-3.5 h-full flex flex-col gap-2">
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <Salad size={12} className="text-emerald-700" />
          <p className="text-[11px] font-bold text-slate-900">Mes recettes</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-1 py-0.5 rounded">1 critique</span>
        </div>
      </div>
      <p className="text-[8px] text-slate-400 -mt-1">Santé de votre carte, en temps réel.</p>

      {/* Header stats */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-white border border-slate-100 p-2 grid grid-cols-3 gap-1 shadow-sm"
      >
        {[
          { label: "Critiques", value: 1, tone: "text-rose-600" },
          { label: "Surveiller", value: 1, tone: "text-amber-600" },
          { label: "Saines", value: 2, tone: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">{s.label}</p>
            <p className={`text-[14px] font-bold tabular-nums leading-none ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Liste plats avec drift live */}
      <div className="space-y-1.5 flex-1">
        {dishes.map((d, i) => {
          const t = tones[d.tone];
          const Icon = d.drift > 0 ? TrendingUp : d.drift < 0 ? TrendingDown : null;
          return (
            <motion.div
              key={d.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className="rounded-xl border border-slate-100 bg-white p-2 flex items-center gap-2 shadow-sm"
            >
              <div className={`w-1 self-stretch rounded-full ${t.bar}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-900 truncate leading-tight">{d.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[7px] font-bold tabular-nums px-1 py-0.5 rounded border ${t.chip}`}>
                    Marge {d.marge}%
                  </span>
                  {d.drift !== 0 && Icon && (
                    <span className={`text-[7px] font-bold tabular-nums flex items-center gap-0.5 ${t.drift}`}>
                      <Icon size={8} />
                      {d.drift > 0 ? "+" : ""}{d.drift}%
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={10} className="text-slate-300 flex-shrink-0" />
            </motion.div>
          );
        })}
      </div>

      {/* Hint simulateur */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="rounded-lg bg-blue-50 border border-blue-100 px-2 py-1.5 flex items-center gap-1.5"
      >
        <ScanLine size={10} className="text-blue-600 flex-shrink-0" />
        <span className="text-[8px] text-slate-700 leading-tight">
          Simulez 180g au lieu de 200g pour ramener au vert.
        </span>
      </motion.div>
    </motion.div>
  );
}
