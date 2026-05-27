// Pipeline client de scan d'une facture : POST /api/invoices/process puis
// polling de la table `invoices` toutes les 3s pour suivre `processing_step`.
//
// Côté API : la route répond 202 immédiatement avec { invoice_id }, l'edge
// function tourne en background. Côté client on poll jusqu'à `processed` /
// `error` / `duplicate`, ou timeout dur à 90s.

import { supabase } from "@/lib/supabase-browser";
import { type BatchItem } from "../_components/types";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;
const MAX_CONSECUTIVE_ERRORS = 3;

/** L'API a renvoyé 402 sans QUOTA_EXCEEDED → essai expiré, paiement requis. */
export class PaymentRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentRequiredError";
  }
}

/** L'API a renvoyé 402 avec QUOTA_EXCEEDED → forfait mensuel atteint. */
export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export const isPaymentRequired = (err: unknown): boolean =>
  err instanceof Error && err.name === "PaymentRequiredError";

export const isQuotaExceeded = (err: unknown): boolean =>
  err instanceof Error && err.name === "QuotaExceededError";

export type ProcessOneResult = {
  supplier?: string | null;
  itemsCount?: number;
  /** Compteur de quota mis à jour côté server (lu après status='processed'). */
  scansUsed?: number;
};

/** Signal de cancel pour le polling. Le caller flippe `cancelled = true`
 *  dans un cleanup useEffect quand le composant se démonte → le polling
 *  arrête à la prochaine itération sans appeler `onStep` (qui ferait un
 *  setState sur composant démonté = warning React + memory leak). */
export type ProcessSignal = { cancelled: boolean };

/**
 * Traite un fichier unique. Délègue au polling de la table invoices pour
 * remonter les sous-états (`processingStep`) au caller via `onStep`.
 *
 * @param onStep callback appelé à chaque tick de polling avec le step courant
 * @param onSessionLost callback si la session expire (le caller doit redirect)
 * @param signal optionnel — flippe `signal.cancelled = true` pour stopper
 *               proprement (utile lors du démontage du composant caller).
 */
export async function processOne(
  file: File,
  onStep: (step: {
    processingStep?: BatchItem["processingStep"];
    totalItemsCount?: number | null;
  }) => void,
  onSessionLost: () => void,
  signal?: ProcessSignal,
): Promise<ProcessOneResult> {
  // [batch-diag] log temporaire — à retirer après identification du bug scan caméra (phase 2, pinpoint sortie anticipée boucle)
  console.log("[batch-diag] processOne enter", {
    fileName: file.name,
    timestamp: new Date().toISOString(),
  });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    onSessionLost();
    throw new Error("Session expirée");
  }
  const formData = new FormData();
  formData.append("invoice", file);
  // [batch-diag] log temporaire — à retirer après identification du bug scan caméra (phase 2, pinpoint sortie anticipée boucle)
  console.log("[batch-diag] processOne pre-fetch", {
    fileName: file.name,
    timestamp: new Date().toISOString(),
  });
  const res = await fetch("/api/invoices/process", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });
  // [batch-diag] log temporaire — à retirer après identification du bug scan caméra (phase 2, pinpoint sortie anticipée boucle)
  console.log("[batch-diag] processOne post-fetch", {
    fileName: file.name,
    httpStatus: res.status,
    timestamp: new Date().toISOString(),
  });
  if (res.status === 402) {
    const j = await res.json().catch(() => ({}));
    if (j?.code === "QUOTA_EXCEEDED") {
      throw new QuotaExceededError(j?.error ?? "Quota mensuel atteint");
    }
    throw new PaymentRequiredError(j?.error ?? "Abonnement requis");
  }
  if (!res.ok) {
    let msg = "Lecture impossible";
    try {
      const j = await res.json();
      msg = j?.error ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  const ack = await res.json().catch(() => ({})) as { invoice_id?: string };
  const invoiceId = ack.invoice_id;
  if (!invoiceId) throw new Error("Réponse serveur invalide");

  // ─── Polling 3s ───
  // Tolère 3 erreurs réseau consécutives avant d'abandonner — au-delà c'est
  // une vraie panne, pas un hoquet 4G.
  const startedAt = Date.now();
  let consecutiveErrors = 0;

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    if (signal?.cancelled) {
      throw new Error("Scan annulé");
    }

    let pollResult;
    try {
      pollResult = await supabase
        .from("invoices")
        .select("status, processing_step, total_items_count, error_message, supplier:suppliers(name)")
        .eq("id", invoiceId)
        .maybeSingle();
    } catch {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(
          "Connexion instable. Le scan continue en arrière-plan, rechargez dans quelques secondes.",
        );
      }
      continue;
    }

    const { data, error } = pollResult;
    if (error) {
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error("Impossible de lire le statut du scan. Rechargez la page pour voir le résultat.");
      }
      continue;
    }
    if (!data) {
      consecutiveErrors = 0;
      continue;
    }
    consecutiveErrors = 0;

    const row = data as unknown as {
      status: string;
      processing_step: string | null;
      total_items_count: number | null;
      error_message: string | null;
      supplier: { name: string } | null;
    };

    onStep({
      processingStep: row.processing_step as BatchItem["processingStep"],
      totalItemsCount: row.total_items_count,
    });

    if (row.status === "processed") {
      // Récupère le compteur de quota mis à jour. Le caller est libre de
      // l'utiliser ou pas — on le remonte par commodité.
      const yearMonth = new Date().toISOString().slice(0, 7);
      const { data: u } = await supabase
        .from("usage_stats")
        .select("scan_count")
        .eq("year_month", yearMonth)
        .maybeSingle();
      const used = (u as { scan_count?: number } | null)?.scan_count;
      return {
        supplier: row.supplier?.name ?? null,
        itemsCount: row.total_items_count ?? undefined,
        scansUsed: typeof used === "number" ? used : undefined,
      };
    }
    if (row.status === "duplicate") {
      throw new Error("Cette facture a déjà été enregistrée.");
    }
    if (row.status === "error") {
      // L'edge function a écrit un message précis dans error_message
      // (PDF non supporté, image illisible, etc.). On le propage tel quel ;
      // fallback générique uniquement si la colonne est vide (vieille facture).
      throw new Error(row.error_message ?? "Lecture impossible — réessayez avec une photo plus nette.");
    }
  }
  throw new Error("L'analyse prend trop de temps. Réessayez dans un moment.");
}
