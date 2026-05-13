"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

/** Bandeau bleu : activation Stripe en cours (webhook pas encore arrivé). */
export function ActivatingBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
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
  );
}

/** Bandeau vert : confirmation de paiement (auto-disparait après 4s, géré par le caller). */
export function ActivatedBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 border-2 border-emerald-200 bg-emerald-50 flex items-center gap-3"
    >
      <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-emerald-900 font-semibold text-sm">Bienvenue chez YIELD Starter</p>
        <p className="text-emerald-700 text-xs">200 scans par mois, alertes temps réel, conciergerie.</p>
      </div>
    </motion.div>
  );
}

/**
 * Bandeau rouge non-dismissable : essai expiré après réception d'un 402 sur
 * /api/invoices/process. Force l'utilisateur à passer au paiement.
 */
export function PaymentRequiredBanner({
  show,
  loading,
  onCheckout,
}: {
  show: boolean;
  loading: boolean;
  onCheckout: () => void;
}) {
  if (!show) return null;
  return (
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
          onClick={onCheckout}
          disabled={loading}
          className="w-full bg-white text-red-700 font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-70"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-red-200 border-t-red-700 rounded-full animate-spin" />
              Ouverture du paiement…
            </>
          ) : (
            "S'abonner maintenant"
          )}
        </button>
      </div>
    </motion.div>
  );
}

/** Bandeau orange : erreur de billing (typiquement timeout webhook Stripe). */
export function BillingErrorBanner({
  message,
  onRefresh,
  onDismiss,
}: {
  message: string | null;
  onRefresh: () => Promise<void> | void;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 bg-amber-50 border border-amber-200 flex items-start gap-3"
    >
      <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-amber-800 text-sm font-medium">Activation en attente</p>
        <p className="text-amber-700 text-xs leading-relaxed mt-0.5 break-words">{message}</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => void onRefresh()}
            className="btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            Rafraîchir le statut
          </button>
          <button onClick={onDismiss} className="text-amber-600 hover:text-amber-800 text-xs underline">
            Fermer
          </button>
        </div>
      </div>
    </motion.div>
  );
}
