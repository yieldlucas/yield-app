"use client";

// /dashboard/recipes/[id] — Détail d'une recette.
//
// Écran 360° :
//   - Marge brute live + dérive vs baseline (+ CTA "Réinitialiser le baseline")
//   - Liste ingrédients avec dérive par ligne + saisie manuelle prix de secours
//   - Simulateur de portion : on touche les quantités, la marge se met à jour
//     en live SANS écrire en BDD ; un bouton applique le brouillon en bulk.
//   - Édition du prix de vente cible.

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowLeft, Check, ChefHat, History, Pencil, RotateCcw,
  Save, Sliders, Trash2, TrendingDown, TrendingUp, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import {
  fetchRecipeDetail,
  fetchProductUsageInOtherRecipes,
  updateRecipeSellingPrice,
  updateIngredientQuantity,
  updateIngredientManualPrice,
  rebaselineRecipe,
  deleteRecipe,
  unitConversionFactor,
  type RecipeDetail,
  type RecipeHealth,
  type RecipeIngredientRow,
} from "../../_lib/recipes-data";

const MARGIN_GREEN = 75;
const MARGIN_ORANGE = 70;

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Brouillon de quantités pour le simulateur (clé = ingredient.id, valeur = qty draft)
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Édition prix de vente / TVA inline
  const [editPrice, setEditPrice] = useState(false);
  const [draftPrice, setDraftPrice] = useState<string>("");
  const [draftVat, setDraftVat] = useState<number>(10);

  // Modale saisie manuelle prix par ingrédient (id de l'ingrédient en cours)
  const [manualEditId, setManualEditId] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState<string>("");

  // Confirm rebaseline / delete
  const [confirmRebaseline, setConfirmRebaseline] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Map product_id → nombre d'AUTRES recettes utilisant ce produit.
  // Permet de montrer au chef l'impact transverse d'un ingrédient
  // (ex: "le beurre est dans 7 autres plats"), donc l'urgence d'agir
  // quand son prix dérape.
  const [crossUsage, setCrossUsage] = useState<Record<string, number>>({});

  const reload = async () => {
    const r = await fetchRecipeDetail(id);
    setRecipe(r);
    setLoading(false);
    if (r) {
      setDrafts({}); // reset le brouillon après reload
      setDraftPrice(r.selling_price != null ? String(r.selling_price) : "");
      setDraftVat(r.vat_rate ?? 10);
      // Fetch en parallèle : la liste des recettes utilisant les mêmes
      // ingrédients. Si erreur, on bail silencieux — l'info est nice-to-have,
      // pas critique.
      const productIds = r.ingredients
        .map((i) => i.product_id)
        .filter((p): p is string => !!p);
      if (productIds.length > 0) {
        const usage = await fetchProductUsageInOtherRecipes(r.id, productIds);
        setCrossUsage(usage);
      } else {
        setCrossUsage({});
      }
    } else {
      setError("Recette introuvable ou non accessible.");
    }
  };

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/"); return; }
      await reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  // ─── Calcul live avec brouillons portion ───
  const sim = useMemo(() => {
    if (!recipe) return null;
    let totalCost = 0;
    let hasUnpriced = false;
    const lines = recipe.ingredients.map((ing) => {
      const qty = drafts[ing.id] ?? ing.quantity;
      const factor = unitConversionFactor(
        ing.quantity_unit || ing.product_unit || ing.unit,
        ing.product_unit || ing.quantity_unit || ing.unit,
      );
      const price = ing.current_price_ht;
      if (price == null) { hasUnpriced = true; return { ing, qty, subtotal: null as number | null }; }
      const subtotal = price * qty * factor;
      totalCost += subtotal;
      return { ing, qty, subtotal };
    });
    const sellingTtc = recipe.selling_price;
    const vat = recipe.vat_rate ?? 10;
    const sellingHt = sellingTtc != null ? sellingTtc / (1 + vat / 100) : null;
    const marginEur = sellingHt != null ? sellingHt - totalCost : null;
    const marginPct = sellingHt != null && sellingHt > 0 && marginEur != null
      ? (marginEur / sellingHt) * 100 : null;
    return {
      totalCost,
      sellingHt,
      marginEur,
      marginPct,
      hasUnpriced,
      lines,
      hasDrafts: Object.keys(drafts).length > 0,
    };
  }, [recipe, drafts]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      </main>
    );
  }
  if (!recipe || !sim) {
    return (
      <main className="min-h-screen p-8 text-center bg-slate-50">
        <p className="text-slate-600">{error ?? "Erreur de chargement."}</p>
        <Link href="/dashboard/recipes" className="text-blue-600 underline mt-4 inline-block">
          Retour aux recettes
        </Link>
      </main>
    );
  }

  const marginTone =
    sim.marginPct == null ? "text-slate-400"
      : sim.marginPct >= MARGIN_GREEN ? "text-emerald-600"
        : sim.marginPct >= MARGIN_ORANGE ? "text-amber-600"
          : "text-rose-600";
  const marginBgTone =
    sim.marginPct == null ? "bg-slate-50 border-slate-200"
      : sim.marginPct >= MARGIN_GREEN ? "bg-emerald-50 border-emerald-100"
        : sim.marginPct >= MARGIN_ORANGE ? "bg-amber-50 border-amber-100"
          : "bg-rose-50 border-rose-100";
  const marginBarColor =
    sim.marginPct == null ? "bg-slate-200"
      : sim.marginPct >= MARGIN_GREEN ? "bg-emerald-500"
        : sim.marginPct >= MARGIN_ORANGE ? "bg-amber-500"
          : "bg-rose-500";

  const drift = recipe.cost_drift_pct;

  // ─── Handlers ───
  const applyDrafts = async () => {
    setSavingDrafts(true);
    try {
      // Séquentiel pour éviter de saturer la connexion Supabase. ~10 ingrédients
      // max par recette typique → quelques 100ms acceptables.
      for (const [ingId, qty] of Object.entries(drafts)) {
        await updateIngredientQuantity(ingId, qty);
      }
      await reload();
      setSavedFlash(true);
      // 3s pour que l'user ait le temps de voir la confirmation et la
      // marge mise à jour dans l'écran (1.8s était trop court — l'œil
      // n'a pas le temps de capter le changement).
      setTimeout(() => setSavedFlash(false), 3000);
    } finally {
      setSavingDrafts(false);
    }
  };

  const saveSellingPrice = async () => {
    const parsed = parseFloat(draftPrice);
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    const ok = await updateRecipeSellingPrice(recipe.id, value, draftVat);
    if (ok) {
      setEditPrice(false);
      await reload();
    }
  };

  const saveManualPrice = async () => {
    if (!manualEditId) return;
    const parsed = parseFloat(manualValue);
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    const ok = await updateIngredientManualPrice(manualEditId, value);
    if (ok) {
      setManualEditId(null);
      setManualValue("");
      await reload();
    }
  };

  const doRebaseline = async () => {
    const ok = await rebaselineRecipe(recipe.id);
    setConfirmRebaseline(false);
    if (ok) await reload();
  };
  const doDelete = async () => {
    const ok = await deleteRecipe(recipe.id);
    setConfirmDelete(false);
    if (ok) router.replace("/dashboard/recipes");
  };

  return (
    <main className="min-h-screen pb-32" style={{ background: "#F7F9FF" }}>
      {/* Header */}
      <div className="glass-nav sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <Link
            href="/dashboard/recipes"
            className="text-slate-500 hover:text-blue-600 transition-colors"
            aria-label="Retour aux recettes"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl btn-primary flex items-center justify-center flex-shrink-0">
              <ChefHat size={16} className="text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm truncate">{recipe.name}</p>
          </div>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-slate-300 hover:text-rose-500 transition-colors"
            aria-label="Supprimer la recette"
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-6 space-y-5">
        {/* ── Bandeau marge / drift ── */}
        <div className={`rounded-2xl border p-5 ${marginBgTone} transition-colors`}>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Marge brute actuelle
              </p>
              <p className={`text-3xl font-bold tabular-nums leading-tight ${marginTone}`}>
                {sim.marginPct == null ? "—" : `${sim.marginPct.toFixed(1)}%`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Marge €
              </p>
              <p className={`text-xl font-bold tabular-nums leading-tight ${marginTone}`}>
                {fmtEur(sim.marginEur)}
              </p>
            </div>
          </div>
          {/* Jauge */}
          <div className="h-2 rounded-full bg-white/60 overflow-hidden mb-1.5">
            <div
              className={`h-full transition-all ${marginBarColor}`}
              style={{ width: `${Math.min(Math.max(sim.marginPct ?? 0, 0), 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0%</span><span>{MARGIN_ORANGE}%</span><span>{MARGIN_GREEN}%</span><span>100%</span>
          </div>

          {/* Drift baseline */}
          {drift != null && Math.abs(drift) >= 0.5 && (
            <DriftPanel
              drift={drift}
              currentCost={sim.totalCost}
              baselineCost={recipe.baseline_cost_ht}
              baselineDate={recipe.baseline_recorded_at}
              onRebaseline={() => setConfirmRebaseline(true)}
            />
          )}
        </div>

        {/* ── Prix de vente cible (édition inline) ── */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Prix de vente cible
            </p>
            {!editPrice && (
              <button
                onClick={() => setEditPrice(true)}
                className="text-blue-600 hover:text-blue-700 transition-colors text-[12px] font-semibold flex items-center gap-1"
              >
                <Pencil size={12} /> Modifier
              </button>
            )}
          </div>
          {editPrice ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input
                  type="number" inputMode="decimal" step="0.01" min={0}
                  value={draftPrice}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setDraftPrice(e.target.value)}
                  placeholder="0,00 € TTC"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200"
                  autoFocus
                />
              </div>
              <select
                value={draftVat}
                onChange={(e) => setDraftVat(parseFloat(e.target.value))}
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm bg-white"
              >
                <option value={5.5}>TVA 5,5%</option>
                <option value={10}>TVA 10%</option>
                <option value={20}>TVA 20%</option>
              </select>
              <button
                onClick={() => void saveSellingPrice()}
                className="col-span-2 btn-primary py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
              >
                <Check size={14} /> Enregistrer
              </button>
              <button
                onClick={() => { setEditPrice(false); setDraftPrice(recipe.selling_price?.toString() ?? ""); }}
                className="border border-slate-200 rounded-lg text-sm text-slate-500 hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          ) : recipe.selling_price != null ? (
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {fmtEur(recipe.selling_price)}
              <span className="ml-2 text-xs font-normal text-slate-400">
                TTC · TVA {recipe.vat_rate?.toString().replace(".", ",") ?? "10"}%
              </span>
            </p>
          ) : (
            // Empty state actionnable : un clic suffit pour ouvrir l'édition,
            // au lieu d'afficher un texte gris non-cliquable qui force à
            // chercher le bouton "Modifier" en haut.
            <button
              onClick={() => { setEditPrice(true); setDraftPrice(""); }}
              className="w-full text-left text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg px-3 py-2.5 flex items-center gap-2 transition-colors"
            >
              <Pencil size={13} />
              Définir le prix de vente cible
            </button>
          )}
        </div>

        {/* ── Coût matière + Ingrédients ── */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Composition ({recipe.ingredients.length})
            </p>
            <p className="text-[11px] text-slate-500 tabular-nums">
              Coût matière : <strong className="text-slate-900">{fmtEur(sim.totalCost)}</strong> HT
            </p>
          </div>
          <ul className="space-y-2">
            {sim.lines.map(({ ing, qty, subtotal }) => (
              <IngredientLine
                key={ing.id}
                ing={ing}
                draftQty={qty}
                isDrafted={drafts[ing.id] != null && drafts[ing.id] !== ing.quantity}
                subtotal={subtotal}
                onChangeQty={(v) => setDrafts((prev) => ({ ...prev, [ing.id]: v }))}
                onResetQty={() => setDrafts((prev) => {
                  const next = { ...prev };
                  delete next[ing.id];
                  return next;
                })}
                onEditManual={() => {
                  setManualEditId(ing.id);
                  setManualValue(ing.manual_price_ht?.toString() ?? "");
                }}
                otherRecipesCount={ing.product_id ? (crossUsage[ing.product_id] ?? 0) : 0}
              />
            ))}
          </ul>
        </div>

        {/* ── Notes / méta ── */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-[12px] text-slate-500 leading-relaxed">
          <div className="flex items-center gap-1.5 mb-1 text-slate-700 font-semibold">
            <History size={12} />
            Référence (baseline)
          </div>
          Coût matière initial : <strong>{fmtEur(recipe.baseline_cost_ht)}</strong>
          {" · "}enregistré le {fmtDate(recipe.baseline_recorded_at)}.
          Toute hausse depuis cette date est mesurée comme <em>dérive</em>.
        </div>
      </div>

      {/* ── Footer sticky : simulateur portion ── */}
      <AnimatePresence>
        {sim.hasDrafts && (
          <motion.div
            initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
            className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-2xl"
          >
            <div className="max-w-lg mx-auto px-5 py-3 flex items-center gap-3">
              <Sliders size={16} className="text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-700">Simulation en cours</p>
                <p className="text-[11px] text-slate-400 truncate">
                  Marge simulée : {sim.marginPct?.toFixed(1) ?? "—"}% · {fmtEur(sim.marginEur)}
                </p>
              </div>
              <button
                onClick={() => setDrafts({})}
                className="text-[12px] font-semibold text-slate-500 hover:text-slate-800 px-2"
              >
                Annuler
              </button>
              <button
                onClick={() => void applyDrafts()}
                disabled={savingDrafts}
                className="btn-primary px-4 py-2 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                {savingDrafts ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sauvegarde…
                  </>
                ) : (
                  <><Save size={12} /> Appliquer</>
                )}
              </button>
            </div>
          </motion.div>
        )}
        {savedFlash && !sim.hasDrafts && (
          <motion.div
            initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
            className="fixed bottom-0 left-0 right-0 z-30 bg-emerald-600 text-white"
          >
            <div className="max-w-lg mx-auto px-5 py-2.5 text-[13px] flex items-center gap-2">
              <Check size={14} /> Quantités mises à jour
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modale prix manuel ── */}
      <AnimatePresence>
        {manualEditId && (
          <ConfirmModal
            title="Prix d'achat manuel"
            description="Saisissez un prix HT par unité. Sera utilisé tant que le produit n'est pas re-scanné."
            onConfirm={() => void saveManualPrice()}
            onCancel={() => { setManualEditId(null); setManualValue(""); }}
            confirmLabel="Enregistrer"
          >
            <input
              type="number" inputMode="decimal" step="0.01" min={0}
              value={manualValue}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="0,00 € HT / unité produit"
              autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button
              onClick={() => setManualValue("")}
              className="mt-2 text-[11px] text-slate-400 hover:text-slate-700 underline"
            >
              Effacer (revenir au dernier scan)
            </button>
          </ConfirmModal>
        )}
        {confirmRebaseline && (
          <ConfirmModal
            title="Réinitialiser la référence"
            description="Le coût actuel devient la nouvelle baseline. La dérive repart de zéro. Utile après une renégociation fournisseur."
            onConfirm={() => void doRebaseline()}
            onCancel={() => setConfirmRebaseline(false)}
            confirmLabel="Réinitialiser"
          />
        )}
        {confirmDelete && (
          <ConfirmModal
            title="Supprimer cette recette ?"
            description="Action irréversible. La recette et ses ingrédients disparaissent. Vos scans ne sont pas affectés."
            onConfirm={() => void doDelete()}
            onCancel={() => setConfirmDelete(false)}
            confirmLabel="Supprimer"
            danger
          />
        )}
      </AnimatePresence>
    </main>
  );
}

// ─── Drift panel ─────────────────────────────────────────
function DriftPanel({
  drift, currentCost, baselineCost, baselineDate, onRebaseline,
}: {
  drift: number; currentCost: number; baselineCost: number;
  baselineDate: string; onRebaseline: () => void;
}) {
  const isUp = drift > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const tone = isUp ? "text-rose-700 bg-rose-50/60" : "text-emerald-700 bg-emerald-50/60";
  const sign = isUp ? "+" : "";
  return (
    <div className={`mt-4 rounded-xl ${tone} p-3 flex items-start gap-2.5`}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-[12px] leading-relaxed">
        <p className="font-semibold tabular-nums">
          Coût matière {sign}{drift.toFixed(1)}% depuis le {fmtDate(baselineDate)}
        </p>
        <p className="text-[11px] opacity-80 tabular-nums">
          {fmtEur(baselineCost)} → {fmtEur(currentCost)}
        </p>
      </div>
      <button
        onClick={onRebaseline}
        className="text-[11px] font-semibold underline hover:no-underline whitespace-nowrap"
        title="Aligne la référence sur le coût actuel"
      >
        Réinitialiser
      </button>
    </div>
  );
}

// ─── Ligne ingrédient ────────────────────────────────────
function IngredientLine({
  ing, draftQty, isDrafted, subtotal,
  onChangeQty, onResetQty, onEditManual, otherRecipesCount,
}: {
  ing: RecipeIngredientRow;
  draftQty: number;
  isDrafted: boolean;
  subtotal: number | null;
  onChangeQty: (v: number) => void;
  onResetQty: () => void;
  onEditManual: () => void;
  /** Nombre d'AUTRES recettes utilisant le même product_id. Affiche un badge
   *  "Utilisé dans X recettes" pour montrer l'impact transverse du drift. */
  otherRecipesCount: number;
}) {
  const drift = ing.price_drift_pct;
  const isUp = drift != null && drift > 0;
  const isDown = drift != null && drift < 0;
  const isManual = ing.manual_price_ht != null;
  const noPrice = ing.current_price_ht == null;

  return (
    <li className={`rounded-2xl border p-3 transition-colors ${
      noPrice ? "bg-amber-50/40 border-amber-100"
        : isDrafted ? "bg-blue-50/40 border-blue-200"
          : "bg-white border-slate-100"
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-slate-900 text-sm truncate">{ing.label}</p>
            {otherRecipesCount > 0 && (
              <span
                className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                title="Cet ingrédient est utilisé dans d'autres recettes — toute variation de prix se propage."
              >
                <ChefHat size={9} />
                {otherRecipesCount === 1
                  ? "1 autre recette"
                  : `${otherRecipesCount} autres recettes`}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 tabular-nums">
            {ing.current_price_ht != null
              ? <>Prix HT : <strong className="text-slate-700">{ing.current_price_ht.toFixed(2)} €</strong>/{ing.product_unit || ing.unit}</>
              : <span className="text-amber-700">Aucun prix connu</span>}
            {isManual && <span className="ml-1.5 text-blue-600 font-semibold">(manuel)</span>}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold tabular-nums text-slate-900">
            {fmtEur(subtotal)}
          </p>
          {drift != null && Math.abs(drift) >= 0.5 && (
            <p className={`text-[10px] font-semibold tabular-nums ${
              isUp ? "text-rose-600" : isDown ? "text-emerald-600" : "text-slate-400"
            }`}>
              {drift > 0 ? "+" : ""}{drift.toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {/* Coupable identifié — affiché si dérive forte */}
      {drift != null && Math.abs(drift) >= 5 && ing.baseline_price_ht != null && ing.current_price_ht != null && (
        <p className={`text-[11px] mb-2 leading-relaxed rounded-md px-2 py-1 ${
          isUp ? "text-rose-700 bg-rose-50" : "text-emerald-700 bg-emerald-50"
        }`}>
          {isUp ? "↗" : "↘"} Évolution prix : {ing.baseline_price_ht.toFixed(2)} €
          {" → "}{ing.current_price_ht.toFixed(2)} €
          {ing.current_price_recorded_at && <> (le {fmtDate(ing.current_price_recorded_at)})</>}
        </p>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
            Quantité ({ing.quantity_unit || ing.product_unit || ing.unit})
          </label>
          <input
            type="number" inputMode="decimal" step="0.01" min={0}
            value={draftQty > 0 ? draftQty : ""}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onChangeQty(Number.isFinite(v) && v > 0 ? v : 0);
            }}
            placeholder="0"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        {isDrafted && (
          <button
            onClick={onResetQty}
            className="text-slate-400 hover:text-slate-700 px-2 py-1.5"
            title="Annuler la modification"
          >
            <RotateCcw size={14} />
          </button>
        )}
        <button
          onClick={onEditManual}
          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
            isManual
              ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
          title="Saisir un prix d'achat manuel (secours)"
        >
          <Pencil size={11} />
          {isManual ? "Manuel" : "Prix"}
        </button>
      </div>

      {noPrice && (
        <p className="mt-2 text-[11px] text-amber-700 flex items-start gap-1.5">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          Aucun scan trouvé. Saisissez un prix manuel pour calculer la marge.
        </p>
      )}
    </li>
  );
}

// ─── Modale générique ────────────────────────────────────
function ConfirmModal({
  title, description, onConfirm, onCancel, confirmLabel,
  children, danger = false,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  children?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-slate-900/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-slate-900 font-bold text-base">{title}</h3>
          <button onClick={onCancel} className="text-slate-300 hover:text-slate-700"><X size={16} /></button>
        </div>
        <p className="text-slate-500 text-sm mb-4 leading-relaxed">{description}</p>
        {children}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
              danger ? "bg-rose-600 hover:bg-rose-700" : "btn-primary"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Helpers ─────────────────────────────────────────────
function fmtEur(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
