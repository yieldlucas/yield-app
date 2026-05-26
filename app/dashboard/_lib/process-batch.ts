// Orchestrateur du traitement séquentiel d'un lot de factures côté client.
// Utilise `processOne` pour chaque item, propage les événements UI via
// callbacks, et reconnaît les 402 (QUOTA_EXCEEDED / SUBSCRIPTION_REQUIRED)
// pour stopper le lot et déclencher le bon flow d'upsell/paiement.

import { type BatchItem } from "../_components/types";
import {
  isPaymentRequired, isQuotaExceeded, processOne, type ProcessSignal,
} from "./process-invoice";

export type BatchInput = BatchItem & { file: File };

/** Callbacks que le composant UI fournit pour réagir au flow. */
export type BatchCallbacks = {
  /** Met à jour un item du batch (status / step / supplier...). */
  updateItem: (id: string, patch: Partial<BatchItem>) => void;
  /** Marque les items "queued" en error avec un message — utilisé sur 402. */
  cancelQueued: (reason: string) => void;
  /** Appelé après chaque scan réussi (libère la photo de l'IDB). */
  onItemSuccess: (id: string, scansUsed: number | undefined) => Promise<void> | void;
  /** Session expirée : le caller doit redirect vers /. */
  onSessionLost: () => void;
  /** Quota mensuel atteint : ouvrir la modal d'upsell. */
  onQuotaExceeded: () => void;
  /** Essai expiré : déclencher le checkout Stripe. */
  onPaymentRequired: () => void;
  /** Tout le batch est terminé (succès ou non) : recharger les données. */
  onBatchFinished: () => void;
};

/**
 * Traite séquentiellement chaque item du batch. Stoppe net si l'API renvoie
 * un 402 — l'UI gère la suite (upsell ou checkout) via les callbacks dédiés.
 *
 * Le `signal` optionnel permet au composant caller d'arrêter le batch lors
 * d'un démontage (cleanup useEffect) — évite les setState orphelins via les
 * callbacks `cb.updateItem` après que le composant a quitté l'écran.
 */
export async function processBatch(
  items: BatchInput[],
  cb: BatchCallbacks,
  signal?: ProcessSignal,
): Promise<void> {
  for (const item of items) {
    if (signal?.cancelled) return;
    cb.updateItem(item.id, { status: "uploading" });
    try {
      // Petit délai pour donner du feedback visuel.
      await new Promise((r) => setTimeout(r, 400));
      if (signal?.cancelled) return;
      cb.updateItem(item.id, { status: "processing" });
      const result = await processOne(
        item.file,
        (step) => { if (!signal?.cancelled) cb.updateItem(item.id, step); },
        cb.onSessionLost,
        signal,
      );
      if (signal?.cancelled) return;
      cb.updateItem(item.id, {
        status: "done",
        supplier: result.supplier,
        itemsCount: result.itemsCount,
      });
      await cb.onItemSuccess(item.id, result.scansUsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      // [batch-diag] log temporaire — à retirer après identification du bug scan caméra (issue runtime A vs C)
      console.error("[batch-diag] item failed", {
        fileName: item.fileName,
        index: items.indexOf(item),
        totalItems: items.length,
        error: msg,
        rawError: err,
        timestamp: new Date().toISOString(),
      });
      if (isQuotaExceeded(err)) {
        cb.updateItem(item.id, { status: "error", error: "Quota mensuel atteint" });
        cb.cancelQueued("Lot annulé : quota atteint");
        cb.onQuotaExceeded();
        return;
      }
      if (isPaymentRequired(err)) {
        cb.updateItem(item.id, { status: "error", error: "Abonnement requis" });
        cb.cancelQueued("Lot annulé : abonnement requis");
        cb.onPaymentRequired();
        return;
      }
      cb.updateItem(item.id, { status: "error", error: msg });
    }
  }
  cb.onBatchFinished();
}
