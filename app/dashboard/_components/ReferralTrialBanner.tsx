"use client";

// Bandeau affiché à la place du TrialBanner classique 14j quand l'user est
// en "essai Starter Pro parrainé" (trial_extra_days > 0). Au lieu de pousser
// l'offre 14j, on confirme son statut premium temporaire + compteur jours
// restants pour qu'il sache quand prendre l'abonnement payant.
//
// Visuel : gradient emerald→bleu (positif, cadeau actif) — différent du bleu
// du TrialBanner pour que l'user perçoive immédiatement qu'il est dans un
// état spécial.

import { motion } from "framer-motion";
import { ChevronRight, Crown, X } from "lucide-react";

export function ReferralTrialBanner({
  show,
  daysLeft,
  totalDays,
  onSubscribe,
  onDismiss,
  loading,
}: {
  show: boolean;
  daysLeft: number;
  totalDays: number;
  onSubscribe: () => void;
  onDismiss: () => void;
  loading: boolean;
}) {
  if (!show) return null;

  // Couleur du badge selon urgence : vert tant qu'il reste > 7j, ambre
  // à partir de 7j (rappel doux pour anticiper la fin), rouge < 3j.
  const urgency = daysLeft <= 3 ? "rose" : daysLeft <= 7 ? "amber" : "default";
  const urgencyBadgeClass = urgency === "rose"
    ? "bg-rose-100 text-rose-700"
    : urgency === "amber"
      ? "bg-amber-100 text-amber-800"
      : "bg-white/20 text-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 text-white relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #059669 0%, #2563EB 100%)" }}
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 80% 30%, rgba(255,255,255,0.14) 0%, transparent 60%)" }} />
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
        aria-label="Masquer"
      >
        <X size={16} />
      </button>
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Crown size={14} className="text-white" />
          <span className="text-white/90 text-xs font-semibold uppercase tracking-wider">
            Essai Starter Pro actif
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <p className="text-2xl font-bold leading-tight">
            {daysLeft} {daysLeft > 1 ? "jours" : "jour"}
          </p>
          <span className="text-white/80 text-sm">
            restant{daysLeft > 1 ? "s" : ""} sur {totalDays}
          </span>
          <span className={`ml-auto inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${urgencyBadgeClass}`}>
            Parrainage
          </span>
        </div>
        <p className="text-white/90 text-sm leading-snug mb-4">
          {daysLeft <= 3
            ? "Votre essai parrainé se termine bientôt. Activez l'abonnement pour ne pas perdre l'accès."
            : daysLeft <= 7
              ? "Pensez à activer votre abonnement avant la fin de l'essai pour conserver l'accès."
              : "Profitez de votre essai Starter Pro complet. À la fin, vous pourrez choisir de continuer."}
        </p>

        <button
          onClick={onSubscribe}
          disabled={loading}
          className="w-full bg-white text-emerald-700 font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors disabled:opacity-70"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-700 rounded-full animate-spin" />
              Ouverture du paiement…
            </>
          ) : (
            <>Activer mon abonnement <ChevronRight size={15} /></>
          )}
        </button>
      </div>
    </motion.div>
  );
}
