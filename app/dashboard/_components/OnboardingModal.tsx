"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Calculator, Camera, ChevronRight, Sparkles } from "lucide-react";
import { YieldLogo } from "@/app/_components/YieldLogo";

const STEPS = [
  { n: "01", Icon: Camera, title: "Photographiez", desc: "Le bon de livraison, à réception, en 5 secondes." },
  { n: "02", Icon: Sparkles, title: "L'IA lit", desc: "Chaque ligne matière est extraite et comparée à vos historiques." },
  { n: "03", Icon: Bell, title: "Alerte marge", desc: "Dès qu'une hausse dépasse 3%, YIELD vous prévient." },
  { n: "04", Icon: Calculator, title: "Pilotez vos marges", desc: "Composez vos plats dans la calculatrice et obtenez un prix de vente conseillé." },
];

const NAME_MIN = 2;
const NAME_MAX = 80;

/**
 * Modal d'accueil affichée à la 1ère visite (état serveur
 * `profiles.onboarding_seen_at`, persisté au dismiss). Deux étapes :
 *
 *   Step 1 — Saisie du nom du restaurant. Persiste dans `profiles.restaurant_name`
 *            via le callback onSubmitName. Le nom apparaît ensuite dans l'en-tête
 *            des PDFs d'export. "Plus tard" passe à l'étape 2 sans sauvegarder.
 *
 *   Step 2 — Pitch en 3 étapes + CTA "Scanner mon premier BL".
 *
 * Le composant gère son state UI (saving, error), le caller fournit juste le
 * handler de persistance et la valeur initiale (utile pour re-onboarding).
 */
export function OnboardingModal({
  show,
  onClose,
  onStart,
  onOpenCalculator,
  onSubmitName,
  initialName = "",
}: {
  show: boolean;
  onClose: () => void;
  onStart: () => void;
  /** Optionnel — ajoute un CTA secondaire ouvrant la calculatrice à la fin
   *  du tutoriel pour faire découvrir l'outil dès le 1er run. */
  onOpenCalculator?: () => void;
  onSubmitName: (name: string) => Promise<void>;
  initialName?: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;

  const goNext = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmitName(trimmed);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

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
              <YieldLogo size={26} toqueColor="white" accentColor="#2563EB" />
            </div>

            {step === 1 ? (
              <>
                <h2 className="text-slate-900 font-bold text-xl text-center mb-2">
                  Bienvenue, chef
                </h2>
                <p className="text-slate-500 text-sm text-center mb-6 leading-relaxed">
                  Comment s&apos;appelle votre restaurant ? Ce nom apparaîtra dans l&apos;en-tête
                  de vos exports PDF et CSV.
                </p>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Nom du restaurant
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canSubmit && !saving) void goNext();
                    }}
                    maxLength={NAME_MAX}
                    placeholder="Le Café Brûlé"
                    autoFocus
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  />
                </label>
                {error && (
                  <p className="mt-2 text-xs text-rose-500" role="alert">
                    {error}
                  </p>
                )}
                <button
                  onClick={() => void goNext()}
                  disabled={!canSubmit || saving}
                  className="btn-primary w-full mt-5 py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      Continuer <ChevronRight size={15} />
                    </>
                  )}
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={saving}
                  className="w-full mt-2 py-2.5 text-sm text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50"
                >
                  Plus tard
                </button>
              </>
            ) : (
              <>
                <h2 className="text-slate-900 font-bold text-xl text-center mb-2">
                  Bienvenue dans votre cockpit
                </h2>
                <p className="text-slate-500 text-sm text-center mb-7 leading-relaxed">
                  Scannez vos BL et ajustez vos prix de vente : YIELD veille sur votre marge.
                </p>
                <div className="space-y-4 mb-7">
                  {STEPS.map((s, i) => (
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
                {onOpenCalculator && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 mb-5 text-[12px] text-slate-600 leading-relaxed">
                    <strong className="text-slate-900">Chef, voici votre cockpit.</strong>{" "}
                    Ajoutez vos ingrédients pour tester la rentabilité d&apos;un nouveau plat
                    ou ajuster vos prix de vente instantanément.
                  </div>
                )}
                <button
                  onClick={onStart}
                  className="btn-primary w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  <Camera size={15} /> Scanner mon premier BL
                </button>
                {onOpenCalculator && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenCalculator();
                    }}
                    className="w-full mt-2 py-3 rounded-xl text-sm font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    <ChevronRight size={15} className="rotate-180 hidden" />
                    Découvrir la calculatrice de marge
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-full mt-2 py-2.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Plus tard
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
