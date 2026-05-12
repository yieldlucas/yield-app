"use client";

// /dashboard/recipes — Mes Recettes : santé live de la carte.
//
// Cette page lit la vue recipes_with_health (qui calcule en temps réel le
// food cost, la marge brute et la dérive vs baseline). Aucun trigger ni
// notification : l'info est consultée à la demande, conformément au brief
// "zéro bruit".

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowLeft, ChefHat, ChevronRight,
  Salad, Search, Sparkles, TrendingDown, TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import {
  fetchRecipes,
  type RecipeListRow,
  type RecipeHealth,
} from "../_lib/recipes-data";
import { FlashCalculator } from "../_components/FlashCalculator";

type Filter = "all" | "critical" | "warning" | "ok";

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<RecipeListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  // Drawer FlashCalculator monté localement pour pouvoir l'ouvrir depuis
  // l'empty state sans rebondir vers le dashboard home.
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      const rows = await fetchRecipes();
      setRecipes(rows);
      setLoading(false);
    })();
  }, [router]);

  const trimmed = query.trim().toLowerCase();
  const visible = recipes.filter((r) => {
    if (trimmed && !r.name.toLowerCase().includes(trimmed)) return false;
    if (filter === "all") return true;
    return r.health === filter;
  });

  const counts = {
    all: recipes.length,
    critical: recipes.filter((r) => r.health === "critical").length,
    warning: recipes.filter((r) => r.health === "warning").length,
    ok: recipes.filter((r) => r.health === "ok").length,
  };

  return (
    <main className="min-h-screen pb-12" style={{ background: "#F7F9FF" }}>
      {/* Header */}
      <div className="glass-nav sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-slate-500 hover:text-blue-600 transition-colors"
            aria-label="Retour au dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl btn-primary flex items-center justify-center flex-shrink-0">
              <ChefHat size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-sm leading-tight truncate">Mes recettes</p>
              <p className="text-[11px] text-slate-400 leading-tight">
                Santé de votre carte, mise à jour à chaque scan.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-6 space-y-5">
        {/* Strip santé global */}
        <HealthStrip counts={counts} />

        {/* Recherche + filtres */}
        <div className="space-y-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un plat…"
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>
          <FilterTabs filter={filter} onChange={setFilter} counts={counts} />
        </div>

        {/* Liste */}
        {loading ? (
          <SkeletonList />
        ) : recipes.length === 0 ? (
          <EmptyState onCreate={() => setCalcOpen(true)} />
        ) : visible.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">
            Aucune recette ne correspond à ce filtre.
          </p>
        ) : (
          <AnimatePresence>
            <ul className="space-y-2">
              {visible.map((r, i) => (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <RecipeRow recipe={r} />
                </motion.li>
              ))}
            </ul>
          </AnimatePresence>
        )}
      </div>

      {/* FlashCalculator monté localement — permet l'empty state de proposer
          "Créer ma première recette" en 1 clic, sans rebondir vers /dashboard.
          La save redirige vers /dashboard/recipes/[nouvel-id] (logique interne). */}
      <FlashCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />
    </main>
  );
}

// ─── Strip global ────────────────────────────────────────
function HealthStrip({ counts }: { counts: { all: number; critical: number; warning: number; ok: number } }) {
  if (counts.all === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
    >
      <Stat tone="text-rose-600" label="Critiques" value={counts.critical} hint="< 70%" />
      <Stat tone="text-amber-600" label="À surveiller" value={counts.warning} hint="70–75%" />
      <Stat tone="text-emerald-600" label="Saines" value={counts.ok} hint="≥ 75%" />
    </motion.div>
  );
}
function Stat({ tone, label, value, hint }: {
  tone: string; label: string; value: number; hint: string;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-2xl font-bold tabular-nums leading-tight mt-1 ${tone}`}>{value}</p>
      <p className="text-[10px] text-slate-400">{hint}</p>
    </div>
  );
}

// ─── Filtres ─────────────────────────────────────────────
function FilterTabs({ filter, onChange, counts }: {
  filter: Filter;
  onChange: (f: Filter) => void;
  counts: { all: number; critical: number; warning: number; ok: number };
}) {
  const tabs: { key: Filter; label: string; tone: string; count: number }[] = [
    { key: "all", label: "Toutes", tone: "text-slate-700", count: counts.all },
    { key: "critical", label: "Critiques", tone: "text-rose-600", count: counts.critical },
    { key: "warning", label: "À surveiller", tone: "text-amber-600", count: counts.warning },
    { key: "ok", label: "Saines", tone: "text-emerald-600", count: counts.ok },
  ];
  return (
    <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
      {tabs.map((t) => {
        const active = filter === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${
              active
                ? "bg-slate-900 text-white"
                : `bg-white border border-slate-200 ${t.tone} hover:bg-slate-50`
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-[10px] tabular-nums ${active ? "text-white/70" : "text-slate-400"}`}>
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Ligne recette ───────────────────────────────────────
function RecipeRow({ recipe }: { recipe: RecipeListRow }) {
  const tone = healthClasses(recipe.health);
  const drift = recipe.cost_drift_pct;
  return (
    <Link
      href={`/dashboard/recipes/${recipe.id}`}
      className={`block rounded-2xl border bg-white p-4 hover:shadow-md transition-all ${tone.border}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-1.5 self-stretch rounded-full ${tone.bar}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold text-slate-900 text-sm truncate">{recipe.name}</p>
            <ChevronRight size={16} className="text-slate-300 flex-shrink-0 mt-0.5" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <MarginBadge pct={recipe.current_margin_pct} health={recipe.health} />
            {drift != null && Math.abs(drift) >= 0.5 && (
              <DriftBadge pct={drift} />
            )}
            {recipe.has_unpriced_items && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                <AlertCircle size={10} /> Prix manquant
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
            Coût matière : <strong className="text-slate-600">{fmtEur(recipe.current_cost_ht)}</strong>
            {recipe.selling_price != null && (
              <> · Vente : {fmtEur(recipe.selling_price)} TTC</>
            )}
            {" · "}{recipe.items_count} ingrédient{recipe.items_count > 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}

function MarginBadge({ pct, health }: { pct: number | null; health: RecipeHealth }) {
  if (pct == null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
        Prix de vente à fixer
      </span>
    );
  }
  const tone = healthClasses(health);
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${tone.text} ${tone.bg} border ${tone.border} px-2 py-0.5 rounded-md`}>
      Marge {pct.toFixed(1)}%
    </span>
  );
}
function DriftBadge({ pct }: { pct: number }) {
  // Drift = variation du coût matière. Hausse = mauvais (rouge), baisse = bon (vert).
  const isUp = pct > 0;
  const tone = isUp
    ? "text-rose-700 bg-rose-50 border-rose-200"
    : "text-emerald-700 bg-emerald-50 border-emerald-200";
  const Icon = isUp ? TrendingUp : TrendingDown;
  const sign = isUp ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${tone} border px-2 py-0.5 rounded-md`}>
      <Icon size={11} />
      Coût {sign}{pct.toFixed(1)}%
    </span>
  );
}

function healthClasses(health: RecipeHealth): {
  text: string; bg: string; border: string; bar: string;
} {
  switch (health) {
    case "critical":
      return { text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", bar: "bg-rose-400" };
    case "warning":
      return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-400" };
    case "ok":
      return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-400" };
    default:
      return { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", bar: "bg-slate-200" };
  }
}

// ─── États annexes ───────────────────────────────────────
function SkeletonList() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2].map((i) => (
        <li key={i} className="rounded-2xl border border-slate-100 bg-white p-4 animate-pulse">
          <div className="h-4 w-2/3 bg-slate-100 rounded mb-2" />
          <div className="h-3 w-1/2 bg-slate-100 rounded" />
        </li>
      ))}
    </ul>
  );
}
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="card rounded-3xl p-8 text-center border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50/40"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-5 shadow-md">
        <Sparkles size={28} className="text-white" />
      </div>
      <h2 className="text-slate-900 font-bold text-lg mb-2">Composez votre première recette</h2>
      <p className="text-slate-500 text-sm mb-6 leading-relaxed max-w-sm mx-auto">
        Ajoutez vos ingrédients dans la calculatrice. Yield mettra à jour la marge
        et le food cost à chaque nouveau scan de facture, automatiquement.
      </p>
      <button
        onClick={onCreate}
        className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold shadow-blue-lg hover:-translate-y-0.5 transition-transform"
      >
        <Salad size={15} />
        Créer ma première recette
        <ChevronRight size={14} className="-mr-1" />
      </button>
      <p className="text-[11px] text-slate-400 mt-4">
        Astuce : depuis une facture, vous pouvez aussi cliquer{" "}
        <em className="text-slate-600">Créer une recette depuis cette facture</em>{" "}
        pour démarrer plus vite.
      </p>
    </motion.div>
  );
}

function fmtEur(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
