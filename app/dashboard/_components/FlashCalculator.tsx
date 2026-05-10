"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, Search, Sparkles, X } from "lucide-react";
import {
  searchProductsWithLastPrice,
  type ProductWithLastPrice,
} from "../_lib/dashboard-data";

/** Cible de marge brute (%). 75% est l'objectif standard restauration FR
 *  pour un food cost à ~25%. Modifie ici si la cible métier évolue. */
const TARGET_MARGIN_PCT = 75;

/** Seuils colorimétriques de la jauge marge. Sous 50% = perte de rendement. */
const MARGIN_GREEN = 70;
const MARGIN_ORANGE = 50;

/** TVA défaut : restauration sur place = 10% en France métropolitaine.
 *  L'user peut basculer (5,5% bruts / 20% alcool) via le sélecteur. */
const VAT_OPTIONS = [
  { value: 5.5, label: "5,5%" },
  { value: 10, label: "10%" },
  { value: 20, label: "20%" },
];
const DEFAULT_VAT = 10;

/** Produit pré-rempli quand le calculator est ouvert depuis une ligne de
 *  facture (vs ouverture vierge depuis le header). */
export type CalculatorInitialProduct = {
  id?: string;
  name: string;
  unit: string;
  lastPriceHt: number | null;
};

/**
 * Volet coulissant de calcul rapide de marge / prix de vente.
 *
 * Inputs : produit (autocomplete sur catalogue), quantité, prix de vente TTC.
 * Outputs live : coût de revient, marge brute (€), taux de marge (% + jauge).
 *
 * Bouton "Suggérer un prix" calcule le prix TTC pour atteindre TARGET_MARGIN_PCT.
 *
 * Layout : drawer bottom sur mobile, panneau latéral droit sur desktop.
 */
export function FlashCalculator({
  open,
  onClose,
  initialProduct = null,
  initialQuantity = 1,
}: {
  open: boolean;
  onClose: () => void;
  initialProduct?: CalculatorInitialProduct | null;
  initialQuantity?: number;
}) {
  const [query, setQuery] = useState(initialProduct?.name ?? "");
  const [selected, setSelected] = useState<CalculatorInitialProduct | null>(
    initialProduct,
  );
  const [results, setResults] = useState<ProductWithLastPrice[]>([]);
  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [priceTtc, setPriceTtc] = useState<number | null>(null);
  const [vatRate, setVatRate] = useState<number>(DEFAULT_VAT);

  // Sync initialProduct quand le caller le change (ouverture depuis une
  // ligne facture après une autre).
  useEffect(() => {
    if (!open) return;
    setQuery(initialProduct?.name ?? "");
    setSelected(initialProduct);
    setQuantity(initialQuantity);
    setPriceTtc(null);
    setResults([]);
  }, [open, initialProduct, initialQuantity]);

  // Autocomplete : recherche débouncée.
  useEffect(() => {
    if (!open) return;
    if (selected && query === selected.name) {
      // L'utilisateur a sélectionné un produit, pas la peine de re-fetcher.
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const rows = await searchProductsWithLastPrice(query, 8);
      setResults(rows);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open, selected]);

  const calculation = useMemo(() => {
    const lastPrice = selected?.lastPriceHt ?? null;
    const validQty = Number.isFinite(quantity) && quantity > 0;
    const validPrice = priceTtc != null && Number.isFinite(priceTtc) && priceTtc > 0;
    const validCost = lastPrice != null && validQty;

    const costHt = validCost ? lastPrice! * quantity : null;
    const sellingHt = validPrice ? priceTtc! / (1 + vatRate / 100) : null;
    const marginEur =
      costHt != null && sellingHt != null ? sellingHt - costHt : null;
    const marginPct =
      sellingHt != null && sellingHt > 0 && marginEur != null
        ? (marginEur / sellingHt) * 100
        : null;

    // Pour atteindre TARGET_MARGIN_PCT : sellingHt = cost / (1 - target/100)
    const suggestedTtc =
      costHt != null && costHt > 0
        ? (costHt / (1 - TARGET_MARGIN_PCT / 100)) * (1 + vatRate / 100)
        : null;

    return { costHt, sellingHt, marginEur, marginPct, suggestedTtc };
  }, [selected, quantity, priceTtc, vatRate]);

  const marginTone =
    calculation.marginPct == null
      ? "text-slate-400"
      : calculation.marginPct >= MARGIN_GREEN
        ? "text-emerald-600"
        : calculation.marginPct >= MARGIN_ORANGE
          ? "text-amber-600"
          : "text-rose-600";

  const marginBarColor =
    calculation.marginPct == null
      ? "bg-slate-200"
      : calculation.marginPct >= MARGIN_GREEN
        ? "bg-emerald-500"
        : calculation.marginPct >= MARGIN_ORANGE
          ? "bg-amber-500"
          : "bg-rose-500";

  const applySuggestedPrice = () => {
    if (calculation.suggestedTtc != null) {
      setPriceTtc(Math.round(calculation.suggestedTtc * 100) / 100);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:h-screen sm:max-h-screen sm:w-[420px] sm:rounded-none sm:rounded-l-3xl"
            role="dialog"
            aria-label="Calculatrice de marge"
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-3xl sm:rounded-tr-none sm:rounded-tl-3xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calculator size={16} className="text-blue-600" />
                </div>
                <p className="text-slate-900 font-bold text-sm">Calculatrice flash</p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Produit — autocomplete */}
              <div>
                <Label>Produit</Label>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (selected && e.target.value !== selected.name) {
                        setSelected(null);
                      }
                    }}
                    placeholder="Côte de bœuf, persil, pomme de terre…"
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  />
                </div>
                {!selected && results.length > 0 && (
                  <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-white divide-y divide-slate-50">
                    {results.map((r) => (
                      <li key={r.id}>
                        <button
                          onClick={() => {
                            setSelected({
                              id: r.id,
                              name: r.name,
                              unit: r.unit,
                              lastPriceHt: r.last_price_ht,
                            });
                            setQuery(r.name);
                            setResults([]);
                          }}
                          className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
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
                {selected && (
                  <p className="mt-2 text-xs text-slate-500">
                    Dernier prix HT : {selected.lastPriceHt != null
                      ? <strong className="text-slate-800 tabular-nums">{selected.lastPriceHt.toFixed(2)} €/{selected.unit}</strong>
                      : <span className="text-slate-400">non disponible (jamais scanné)</span>}
                  </p>
                )}
              </div>

              {/* Quantité */}
              <div>
                <Label>Quantité {selected ? `(${selected.unit})` : ""}</Label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={Number.isFinite(quantity) ? quantity : ""}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>

              {/* Prix de vente TTC + TVA */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label>Prix de vente TTC (€)</Label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
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

              {/* Résultats */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                <Row label="Coût de revient HT" value={fmtEuros(calculation.costHt)} />
                <Row label="Prix de vente HT" value={fmtEuros(calculation.sellingHt)} />
                <Row
                  label="Marge brute"
                  value={fmtEuros(calculation.marginEur)}
                  valueClass={marginTone}
                  bold
                />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Taux de marge
                    </span>
                    <span className={`text-base font-bold tabular-nums ${marginTone}`}>
                      {calculation.marginPct == null
                        ? "—"
                        : `${calculation.marginPct.toFixed(1)}%`}
                    </span>
                  </div>
                  {/* Jauge */}
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full transition-all ${marginBarColor}`}
                      style={{
                        width: `${Math.min(Math.max(calculation.marginPct ?? 0, 0), 100)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-400 tabular-nums">
                    <span>0%</span>
                    <span>{MARGIN_ORANGE}%</span>
                    <span>{MARGIN_GREEN}%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Suggestion */}
              <button
                onClick={applySuggestedPrice}
                disabled={calculation.suggestedTtc == null}
                className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles size={15} />
                {calculation.suggestedTtc == null
                  ? "Suggérer un prix (sélectionnez un produit)"
                  : `Suggérer ${fmtEuros(calculation.suggestedTtc)} TTC pour ${TARGET_MARGIN_PCT}% de marge`}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
      {children}
    </span>
  );
}

function Row({
  label,
  value,
  valueClass = "text-slate-900",
  bold = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span
        className={`tabular-nums ${valueClass} ${bold ? "font-bold text-base" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}

function fmtEuros(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}
