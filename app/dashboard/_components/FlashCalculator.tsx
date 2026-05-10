"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookmarkPlus, Calculator, Plus, RotateCcw, Search, Sparkles, Trash2, X,
} from "lucide-react";
import {
  searchProductsWithLastPrice,
  type ProductWithLastPrice,
} from "../_lib/dashboard-data";
import { createRecipe, type IngredientInput } from "../_lib/recipes-data";

// ─── Constantes métier ───────────────────────────────────
// Règle d'or restauration française : food cost à 30%, soit un coefficient
// multiplicateur de 3,3 sur le coût matière HT pour calculer le prix de vente HT.
// Référence : guide UMIH / formations CHR. C'est le seuil minimum pour rester
// rentable une fois charges + main d'œuvre déduites.
const COEFFICIENT_PRIX = 3.3;

// Seuils colorimétriques de la jauge marge brute. Conformes au brief produit :
// rouge sous 70%, orange entre 70 et 75%, vert au-dessus.
const MARGIN_GREEN = 75;
const MARGIN_ORANGE = 70;

// TVA défaut : restauration sur place = 10% en France métropolitaine.
const VAT_OPTIONS = [
  { value: 5.5, label: "5,5%" },
  { value: 10, label: "10%" },
  { value: 20, label: "20%" },
];
const DEFAULT_VAT = 10;

// ─── Conversions d'unités ────────────────────────────────
// Pour saisir "150g" sur un produit acheté au kg, on convertit vers l'unité du
// produit avant de multiplier par le prix unitaire. Limité aux familles métier
// les plus fréquentes en cuisine (masse, volume) — les unités exotiques restent
// dégradées en "tel quel".
const TO_BASE_FACTOR: Record<string, number> = {
  kg: 1, g: 0.001,
  l: 1, cl: 0.01, ml: 0.001,
};
const FAMILIES: Record<string, string[]> = {
  kg: ["kg", "g"], g: ["kg", "g"],
  l: ["l", "cl", "ml"], cl: ["l", "cl", "ml"], ml: ["l", "cl", "ml"],
};

function unitsForProduct(productUnit: string | null | undefined): string[] {
  if (!productUnit) return [];
  const u = productUnit.toLowerCase().trim();
  return FAMILIES[u] ?? [u];
}
function convertToProductUnit(qty: number, fromUnit: string, productUnit: string): number {
  const f = fromUnit.toLowerCase();
  const p = productUnit.toLowerCase();
  if (f === p) return qty;
  const fromFactor = TO_BASE_FACTOR[f];
  const toFactor = TO_BASE_FACTOR[p];
  if (fromFactor == null || toFactor == null) return qty;
  return (qty * fromFactor) / toFactor;
}

// ─── Types publics ───────────────────────────────────────
/** Ingrédient pré-rempli (ex : ouverture depuis une ligne de facture). */
export type CalculatorInitialIngredient = {
  productId?: string;
  name: string;
  unit: string;
  pricePerUnitHt: number | null;
  quantity?: number;
  quantityUnit?: string;
};
// ─── Modèle interne d'un ingrédient ──────────────────────
type Ingredient = {
  /** Identifiant local UI, pas persisté. */
  uid: string;
  productId: string | null;
  name: string;
  /** Unité de référence du produit (issue du catalogue, ex: "kg"). */
  unit: string;
  pricePerUnitHt: number | null;
  /** Quantité saisie dans l'unité UI ci-dessous. */
  quantity: number;
  /** Unité saisie par l'user (ex: "g" alors que le produit est en "kg"). */
  quantityUnit: string;
};

let UID_COUNTER = 0;
const makeEmpty = (): Ingredient => ({
  uid: `i-${++UID_COUNTER}-${Date.now()}`,
  productId: null,
  name: "",
  unit: "",
  pricePerUnitHt: null,
  quantity: 1,
  quantityUnit: "",
});

function fromInitial(init: CalculatorInitialIngredient): Ingredient {
  return {
    uid: `i-${++UID_COUNTER}-${Date.now()}`,
    productId: init.productId ?? null,
    name: init.name,
    unit: init.unit,
    pricePerUnitHt: init.pricePerUnitHt,
    quantity: init.quantity ?? 1,
    quantityUnit: init.quantityUnit ?? init.unit,
  };
}

/**
 * Volet coulissant — Mini Fiche Technique : compose une recette à partir
 * d'ingrédients (autocomplete sur catalogue), affiche le coût de revient
 * total, suggère un prix de vente avec coefficient 3,3, et qualifie la marge
 * brute par une jauge colorée.
 *
 * Layout : drawer bottom sur mobile, panneau latéral droit sur desktop, avec
 * un footer sticky qui maintient marge € + % visibles pendant le scroll.
 */
export function FlashCalculator({
  open,
  onClose,
  initialIngredients,
}: {
  open: boolean;
  onClose: () => void;
  /** Pré-remplit la liste d'ingrédients (ex: ouverture depuis une facture). */
  initialIngredients?: CalculatorInitialIngredient[];
}) {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([makeEmpty()]);
  const [priceTtc, setPriceTtc] = useState<number | null>(null);
  const [vatRate, setVatRate] = useState<number>(DEFAULT_VAT);
  // Persistance Mes Recettes : ouvre une mini-modal pour saisir le nom puis
  // crée la recette via createRecipe(). Redirige vers le détail au succès.
  const [saveOpen, setSaveOpen] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Re-seed la liste à chaque ouverture (sinon une 2e ouverture montrerait
  // l'ancien état). Quand pas de seed, on amorce avec 1 ligne brouillon.
  useEffect(() => {
    if (!open) return;
    if (initialIngredients && initialIngredients.length > 0) {
      setIngredients(initialIngredients.map(fromInitial));
    } else {
      setIngredients([makeEmpty()]);
    }
    setPriceTtc(null);
  }, [open, initialIngredients]);

  const calc = useMemo(() => {
    let totalCostHt = 0;
    let countValid = 0;
    for (const ing of ingredients) {
      if (ing.pricePerUnitHt == null || !Number.isFinite(ing.quantity) || ing.quantity <= 0) continue;
      const qtyInProductUnit = convertToProductUnit(ing.quantity, ing.quantityUnit || ing.unit, ing.unit);
      totalCostHt += ing.pricePerUnitHt * qtyInProductUnit;
      countValid++;
    }
    const validPrice = priceTtc != null && Number.isFinite(priceTtc) && priceTtc > 0;
    const sellingHt = validPrice ? priceTtc! / (1 + vatRate / 100) : null;
    const marginEur = sellingHt != null && countValid > 0 ? sellingHt - totalCostHt : null;
    const marginPct = sellingHt != null && sellingHt > 0 && marginEur != null
      ? (marginEur / sellingHt) * 100 : null;
    // Coefficient 3,3 sur HT, puis TVA pour TTC : règle d'or 30% food cost.
    const suggestedTtc = countValid > 0 && totalCostHt > 0
      ? totalCostHt * COEFFICIENT_PRIX * (1 + vatRate / 100)
      : null;
    return { totalCostHt, sellingHt, marginEur, marginPct, suggestedTtc, countValid };
  }, [ingredients, priceTtc, vatRate]);

  const marginTone =
    calc.marginPct == null ? "text-slate-400"
      : calc.marginPct >= MARGIN_GREEN ? "text-emerald-600"
        : calc.marginPct >= MARGIN_ORANGE ? "text-amber-600"
          : "text-rose-600";
  const marginBarColor =
    calc.marginPct == null ? "bg-slate-200"
      : calc.marginPct >= MARGIN_GREEN ? "bg-emerald-500"
        : calc.marginPct >= MARGIN_ORANGE ? "bg-amber-500"
          : "bg-rose-500";
  const marginBgTone =
    calc.marginPct == null ? "bg-slate-50 border-slate-200"
      : calc.marginPct >= MARGIN_GREEN ? "bg-emerald-50 border-emerald-100"
        : calc.marginPct >= MARGIN_ORANGE ? "bg-amber-50 border-amber-100"
          : "bg-rose-50 border-rose-100";

  const updateIngredient = (uid: string, patch: Partial<Ingredient>) => {
    setIngredients((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  };
  const removeIngredient = (uid: string) => {
    setIngredients((prev) => {
      const next = prev.filter((i) => i.uid !== uid);
      return next.length === 0 ? [makeEmpty()] : next;
    });
  };
  const addIngredient = () => setIngredients((prev) => [...prev, makeEmpty()]);
  const resetAll = () => {
    setIngredients([makeEmpty()]);
    setPriceTtc(null);
  };
  const applySuggestedPrice = () => {
    if (calc.suggestedTtc != null) {
      setPriceTtc(Math.round(calc.suggestedTtc * 100) / 100);
    }
  };

  /** Au moins une ligne valorisée + nom non vide = save autorisé.
   *  Le prix de vente est OPTIONNEL — l'user peut sauvegarder une recette
   *  brouillon (il fixera son prix de vente plus tard depuis le détail). */
  const canSaveRecipe = calc.countValid > 0;

  const submitSave = async () => {
    const name = recipeName.trim();
    if (name.length < 2) {
      setSaveError("Donnez un nom à votre recette (2 caractères min)");
      return;
    }
    setSavingRecipe(true);
    setSaveError(null);
    try {
      const payload: IngredientInput[] = ingredients
        .filter((i) => i.pricePerUnitHt != null && i.quantity > 0 && i.name.trim() !== "")
        .map((i) => ({
          productId: i.productId,
          label: i.name.trim(),
          unit: i.unit || i.quantityUnit,
          quantity: i.quantity,
          quantityUnit: i.quantityUnit || i.unit,
          productUnit: i.unit || i.quantityUnit,
          // Si l'ingrédient n'a pas de productId (saisi à la main, hors catalogue),
          // on stocke le prix entré en manual_price_ht pour qu'il survive aux scans.
          manualPriceHt: i.productId == null ? i.pricePerUnitHt : null,
          // Toujours snapshot le prix au moment du save → permet le drift par ligne.
          baselinePriceHt: i.pricePerUnitHt,
        }));
      const id = await createRecipe({
        name,
        sellingPriceTtc: priceTtc,
        vatRate,
        ingredients: payload,
      });
      if (!id) {
        setSaveError("Échec de la sauvegarde — vérifiez votre connexion");
        setSavingRecipe(false);
        return;
      }
      setSaveOpen(false);
      setRecipeName("");
      setSavingRecipe(false);
      onClose();
      router.push(`/dashboard/recipes/${id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erreur inconnue");
      setSavingRecipe(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] flex flex-col rounded-t-3xl bg-white shadow-2xl sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:h-screen sm:max-h-screen sm:w-[480px] sm:rounded-none sm:rounded-l-3xl"
            role="dialog"
            aria-label="Calculatrice de marge"
          >
            {/* ── Header sticky ── */}
            <div className="flex-shrink-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-3xl sm:rounded-tr-none sm:rounded-tl-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <Calculator size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-slate-900 font-bold text-sm leading-tight">Mini fiche technique</p>
                  <p className="text-slate-400 text-[11px] leading-tight">Compose ta recette, vise ta marge.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1 -m-1"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Corps scrollable ── */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <Label>Ingrédients ({ingredients.length})</Label>
                  <button
                    onClick={resetAll}
                    className="text-slate-400 hover:text-slate-700 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 transition-colors"
                    title="Vider la simulation"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                </div>
                <div className="space-y-2.5">
                  {ingredients.map((ing, idx) => (
                    <IngredientRow
                      key={ing.uid}
                      index={idx + 1}
                      ingredient={ing}
                      onChange={(patch) => updateIngredient(ing.uid, patch)}
                      onRemove={() => removeIngredient(ing.uid)}
                      canRemove={ingredients.length > 1}
                    />
                  ))}
                </div>
                <button
                  onClick={addIngredient}
                  className="mt-2.5 w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-500 hover:text-blue-600 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus size={14} /> Ajouter un ingrédient
                </button>
              </div>

              {/* ── Coût de revient total ── */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Coût de revient (food cost)
                  </span>
                  <span className="text-xl font-bold text-slate-900 tabular-nums">
                    {fmtEuros(calc.totalCostHt > 0 ? calc.totalCostHt : null)}
                  </span>
                </div>
                {calc.countValid === 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Sélectionnez un produit avec un dernier prix connu pour démarrer.
                  </p>
                )}
              </div>

              {/* ── Prix de vente TTC + TVA ── */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label>Prix de vente TTC (€)</Label>
                  <input
                    type="number" inputMode="decimal" step="0.01" min={0}
                    value={priceTtc ?? ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setPriceTtc(Number.isFinite(v) ? v : null);
                    }}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  />
                </div>
                <div>
                  <Label>TVA</Label>
                  <select
                    value={vatRate}
                    onChange={(e) => setVatRate(parseFloat(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  >
                    {VAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Suggestion coefficient 3,3 ── */}
              <button
                onClick={applySuggestedPrice}
                disabled={calc.suggestedTtc == null}
                className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles size={15} />
                {calc.suggestedTtc == null
                  ? "Générer un prix suggéré"
                  : `Suggérer ${fmtEuros(calc.suggestedTtc)} TTC (coefficient 3,3)`}
              </button>

              {/* ── Persistance Mes Recettes ── */}
              <button
                onClick={() => setSaveOpen(true)}
                disabled={!canSaveRecipe}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={canSaveRecipe ? "Suit la rentabilité de ce plat à chaque nouveau scan" : "Ajoutez au moins un ingrédient valorisé"}
              >
                <BookmarkPlus size={15} />
                Enregistrer comme recette
              </button>

              {/* ── Détail marge + jauge ── */}
              <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${marginBgTone}`}>
                <Row label="Prix de vente HT" value={fmtEuros(calc.sellingHt)} />
                <Row label="Marge brute" value={fmtEuros(calc.marginEur)} valueClass={marginTone} bold />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Taux de marge brute
                    </span>
                    <span className={`text-base font-bold tabular-nums ${marginTone}`}>
                      {calc.marginPct == null ? "—" : `${calc.marginPct.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full transition-all ${marginBarColor}`}
                      style={{
                        width: `${Math.min(Math.max(calc.marginPct ?? 0, 0), 100)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400 tabular-nums">
                    <span>0%</span>
                    <span className="text-amber-500">{MARGIN_ORANGE}%</span>
                    <span className="text-emerald-600">{MARGIN_GREEN}%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Coefficient 3,3 = règle d&apos;or restauration FR (food cost à 30%).
                La jauge passe au vert au-dessus de {MARGIN_GREEN}% de marge brute,
                en alerte rouge sous {MARGIN_ORANGE}%.
              </p>
            </div>

            {/* ── Footer sticky : marge live ── */}
            <div className={`flex-shrink-0 border-t-2 px-5 py-3 grid grid-cols-2 gap-4 transition-colors ${
              calc.marginPct == null
                ? "border-slate-100 bg-white"
                : calc.marginPct >= MARGIN_GREEN
                  ? "border-emerald-200 bg-emerald-50/60"
                  : calc.marginPct >= MARGIN_ORANGE
                    ? "border-amber-200 bg-amber-50/60"
                    : "border-rose-200 bg-rose-50/60"
            }`}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Marge €</p>
                <p className={`text-lg font-bold tabular-nums leading-tight ${marginTone}`}>
                  {fmtEuros(calc.marginEur)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Taux</p>
                <p className={`text-lg font-bold tabular-nums leading-tight ${marginTone}`}>
                  {calc.marginPct == null ? "—" : `${calc.marginPct.toFixed(1)}%`}
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Mini-modal "Enregistrer comme recette" ── */}
          {saveOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => !savingRecipe && setSaveOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
              >
                <div className="flex items-center gap-2 mb-3">
                  <BookmarkPlus size={18} className="text-blue-600" />
                  <h3 className="text-slate-900 font-bold text-base">Enregistrer la recette</h3>
                </div>
                <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                  Yield suivra automatiquement la rentabilité de ce plat à chaque
                  nouveau scan de facture.
                </p>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Nom de la recette
                  </span>
                  <input
                    type="text"
                    autoFocus
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void submitSave(); }}
                    placeholder="ex: Tartare de bœuf, frites maison"
                    maxLength={120}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  />
                </label>
                {priceTtc == null && (
                  <p className="mt-2 text-[11px] text-amber-600">
                    Aucun prix de vente saisi — vous le fixerez plus tard depuis le détail.
                  </p>
                )}
                {saveError && (
                  <p className="mt-2 text-xs text-rose-600" role="alert">{saveError}</p>
                )}
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => setSaveOpen(false)}
                    disabled={savingRecipe}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => void submitSave()}
                    disabled={savingRecipe || recipeName.trim().length < 2}
                    className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {savingRecipe ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sauvegarde…
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}

// ─── IngredientRow ───────────────────────────────────────
function IngredientRow({
  index, ingredient, onChange, onRemove, canRemove,
}: {
  index: number;
  ingredient: Ingredient;
  onChange: (patch: Partial<Ingredient>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [results, setResults] = useState<ProductWithLastPrice[]>([]);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<number | null>(null);

  // Autocomplete débouncée — refetche tant que le user n'a pas sélectionné
  // (productId === null) OU que le texte diverge du nom sélectionné.
  useEffect(() => {
    const isSelectedQuery = ingredient.productId != null && ingredient.name === ingredient.name;
    if (!focused) return;
    if (ingredient.productId != null && ingredient.name) {
      // Sélection active : on n'affiche pas la liste, mais on garde focused pour
      // permettre la réouverture si l'user efface.
      setResults([]);
      return;
    }
    void isSelectedQuery; // ignore unused
    const handle = setTimeout(async () => {
      const rows = await searchProductsWithLastPrice(ingredient.name, 6);
      setResults(rows);
    }, 200);
    return () => clearTimeout(handle);
  }, [ingredient.name, ingredient.productId, focused]);

  const select = (p: ProductWithLastPrice) => {
    onChange({
      productId: p.id,
      name: p.name,
      unit: p.unit,
      pricePerUnitHt: p.last_price_ht,
      quantityUnit: p.unit, // par défaut, même unité que le produit
    });
    setResults([]);
    setFocused(false);
  };

  const lineCost = useMemo(() => {
    if (ingredient.pricePerUnitHt == null || !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
      return null;
    }
    const qty = convertToProductUnit(
      ingredient.quantity,
      ingredient.quantityUnit || ingredient.unit,
      ingredient.unit,
    );
    return ingredient.pricePerUnitHt * qty;
  }, [ingredient.pricePerUnitHt, ingredient.quantity, ingredient.quantityUnit, ingredient.unit]);

  const unitChoices = unitsForProduct(ingredient.unit);

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Ingrédient {index}
        </span>
        {canRemove && (
          <button
            onClick={onRemove}
            className="text-slate-300 hover:text-rose-500 transition-colors p-0.5"
            aria-label="Supprimer cet ingrédient"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Autocomplete produit */}
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          value={ingredient.name}
          onChange={(e) => {
            // Si l'user édite le texte d'un produit déjà sélectionné, on
            // déselectionne (productId → null) pour permettre une nouvelle recherche.
            const reset = ingredient.productId != null && e.target.value !== ingredient.name;
            onChange({
              name: e.target.value,
              ...(reset ? { productId: null, pricePerUnitHt: null, unit: "", quantityUnit: "" } : {}),
            });
          }}
          onFocus={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            // Délai pour laisser le clic sur la liste se déclencher avant le blur.
            blurTimer.current = window.setTimeout(() => setFocused(false), 150);
          }}
          placeholder="Rechercher un produit (côte de bœuf, persil…)"
          className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
        {focused && ingredient.productId == null && results.length > 0 && (
          <ul className="absolute left-0 right-0 top-full mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-100 bg-white shadow-lg divide-y divide-slate-50 z-10">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onMouseDown={(e) => e.preventDefault() /* évite blur */}
                  onClick={() => select(r)}
                  className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-slate-50"
                >
                  <span className="text-sm text-slate-800 truncate">{r.name}</span>
                  <span className="text-xs text-slate-400 flex-shrink-0 tabular-nums">
                    {r.last_price_ht != null
                      ? `${r.last_price_ht.toFixed(2)} €/${r.unit}`
                      : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quantité + unité + sous-total */}
      <div className="mt-2 grid grid-cols-12 gap-2 items-end">
        <div className="col-span-5">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
            Quantité
          </label>
          <input
            type="number" inputMode="decimal" step="0.01" min={0}
            value={Number.isFinite(ingredient.quantity) ? ingredient.quantity : ""}
            onChange={(e) => onChange({ quantity: parseFloat(e.target.value) || 0 })}
            placeholder="0"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>
        <div className="col-span-3">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
            Unité
          </label>
          {unitChoices.length > 1 ? (
            <select
              value={ingredient.quantityUnit || ingredient.unit}
              onChange={(e) => onChange({ quantityUnit: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            >
              {unitChoices.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          ) : (
            <div className="w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 text-sm text-slate-500 text-center">
              {ingredient.unit || "—"}
            </div>
          )}
        </div>
        <div className="col-span-4 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Sous-total
          </p>
          <p className="text-sm font-bold text-slate-900 tabular-nums leading-tight">
            {fmtEuros(lineCost)}
          </p>
        </div>
      </div>

      {ingredient.productId != null && ingredient.pricePerUnitHt != null && (
        <p className="mt-2 text-[11px] text-slate-400 tabular-nums">
          Prix HT catalogue : <strong className="text-slate-600">{ingredient.pricePerUnitHt.toFixed(2)} €/{ingredient.unit}</strong>
        </p>
      )}
      {ingredient.productId != null && ingredient.pricePerUnitHt == null && (
        <p className="mt-2 text-[11px] text-amber-600">
          Aucun prix connu pour ce produit — scannez un BL pour l&apos;activer.
        </p>
      )}
    </div>
  );
}

// ─── Helpers UI ──────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
      {children}
    </span>
  );
}
function Row({
  label, value, valueClass = "text-slate-900", bold = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${valueClass} ${bold ? "font-bold text-base" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
function fmtEuros(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }) + " €";
}
