"use client";

import { useEffect } from "react";

const POLL_INTERVAL_MS = 3000;

/**
 * Auto-refresh des factures tant qu'au moins une est en `processing` ou
 * `pending`. La dépendance booléenne `active` est volontairement stable :
 * ça évite de tear-down/rebuild l'interval à chaque tick (ce qui arriverait
 * avec une dep `[invoices]`).
 *
 * `onTick` est appelé toutes les 3s. Cleanup garanti.
 */
export function useInvoicesPolling(active: boolean, onTick: () => void) {
  useEffect(() => {
    if (!active) return;
    const t = setInterval(onTick, POLL_INTERVAL_MS);
    return () => clearInterval(t);
    // onTick capturé par closure — change à chaque render mais l'effet ne se
    // ré-attache que si `active` change. Acceptable car onTick appelle des
    // setters/queries qui sont stables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
