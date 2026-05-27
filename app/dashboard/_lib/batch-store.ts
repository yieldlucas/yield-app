"use client";

// Store global (module-level) du lot de scans en cours. Vit HORS de l'arbre
// React → il survit au démontage de /dashboard quand le chef navigue vers
// /dashboard/recipes ou /dashboard/profile : la boucle continue de tourner,
// l'état des cartes est préservé, et au retour la timeline les retrouve telles
// quelles (exigence "pas de reset pendant la navigation").
//
// Pas de Context/Provider : un singleton + useSyncExternalStore suffit et évite
// de toucher au layout. Les effets de bord propres à la page (modale quota,
// bannière essai, checkout, reload des données) sont injectés par le dashboard
// via setBatchHandlers — appelés s'ils existent, ignorés si la page est
// démontée. Le traitement des fichiers, lui, ne s'arrête jamais.

import { useSyncExternalStore } from "react";
import { removeFromStack } from "@/lib/scan-stack";
import { type BatchItem } from "../_components/types";
import { processBatch, type BatchInput } from "./process-batch";

/** Effets de bord page-spécifiques, ré-enregistrés à chaque montage du dashboard. */
export type BatchHandlers = {
  /** Scan réussi : `scansUsed` = compteur quota à jour (ou undefined). */
  onItemSuccess?: (scansUsed: number | undefined) => void;
  /** Quota mensuel atteint (402) — ouvrir l'upsell. */
  onQuotaExceeded?: () => void;
  /** Essai expiré (402) — déclencher le checkout. */
  onPaymentRequired?: () => void;
  /** Lot terminé (succès ou non) — recharger les données. */
  onBatchFinished?: () => void;
  /** Session perdue — rediriger vers l'accueil. */
  onSessionLost?: () => void;
};

type Snapshot = { items: BatchItem[]; running: boolean };

let items: BatchItem[] = [];
let running = false;
const files = new Map<string, File>();
let handlers: BatchHandlers = {};
const listeners = new Set<() => void>();

// Snapshot immuable recalculé à chaque mutation : useSyncExternalStore exige
// une référence stable entre deux notifications.
let snapshot: Snapshot = { items, running };
const SERVER_SNAPSHOT: Snapshot = { items: [], running: false };

function emit(): void {
  snapshot = { items, running };
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Lit le lot courant + l'indicateur "en cours". À consommer dans le dashboard. */
export function useBatch(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
}

/** Enregistre les effets de bord de la page (au montage) ; passer `{}` au démontage. */
export function setBatchHandlers(h: BatchHandlers): void {
  handlers = h;
}

function patchItem(id: string, patch: Partial<BatchItem>): void {
  items = items.map((x) => (x.id === id ? { ...x, ...patch } : x));
  emit();
}

async function run(input: BatchInput[]): Promise<void> {
  await processBatch(input, {
    updateItem: patchItem,
    cancelQueued: (reason) => {
      items = items.map((x) =>
        x.status === "queued" ? { ...x, status: "error", error: reason } : x,
      );
      emit();
    },
    onItemSuccess: async (id, scansUsed) => {
      // Le stack est vidé dès l'envoi ; ce removeFromStack est un filet (retry,
      // résidus IDB). `.catch` pour ne pas casser la boucle si IDB est indispo.
      await removeFromStack(id).catch(() => {});
      handlers.onItemSuccess?.(scansUsed);
    },
    onSessionLost: () => handlers.onSessionLost?.(),
    onQuotaExceeded: () => { running = false; emit(); handlers.onQuotaExceeded?.(); },
    onPaymentRequired: () => { running = false; emit(); handlers.onPaymentRequired?.(); },
    onBatchFinished: () => { running = false; emit(); handlers.onBatchFinished?.(); },
  });
}

/**
 * Démarre un lot. No-op si un lot tourne déjà ou si l'entrée est vide (garde
 * anti double-envoi). Les cartes provisoires apparaissent immédiatement en
 * statut "queued" ; un nouvel envoi remplace le lot précédent.
 */
export function startBatch(input: BatchInput[]): void {
  if (running || input.length === 0) return;
  running = true;
  files.clear();
  for (const i of input) files.set(i.id, i.file);
  items = input.map((i) => ({ id: i.id, fileName: i.fileName, status: "queued" as const }));
  emit();
  void run(input);
}

/**
 * Re-soumet un item en erreur via le même flow `processOne`. La carte repasse
 * "queued" puis suit le cycle normal. No-op si un lot tourne déjà ou si le
 * fichier n'est plus disponible. Pas de limite de tentatives.
 */
export function retryItem(id: string): void {
  if (running) return;
  const file = files.get(id);
  const item = items.find((x) => x.id === id);
  if (!file || !item) return;
  running = true;
  patchItem(id, { status: "queued", error: undefined, invoiceId: undefined, processingStep: null });
  void run([{ id, fileName: item.fileName, status: "queued", file }]);
}

/** Retire une carte provisoire (ex : erreur définitive que le chef écarte). */
export function dismissItem(id: string): void {
  items = items.filter((x) => x.id !== id);
  files.delete(id);
  emit();
}
