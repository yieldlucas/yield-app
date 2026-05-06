"use client";

import { useEffect } from "react";

const POLL_INTERVAL_MS = 1500;
const POLL_DURATION_MS = 25_000;

/**
 * Polling court (jusqu'à 25s) pour détecter l'activation de l'abonnement
 * après un retour Stripe Checkout. Sert à combler la course entre :
 *   - le redirect navigateur (Stripe → /dashboard?checkout=success)
 *   - le webhook stripe → mise à jour de profiles.is_subscribed
 *
 * `active` = true uniquement quand on revient de Stripe ET qu'on n'est pas
 * encore subscribed. Le hook se ré-attache si ces conditions changent.
 *
 * Cleanup garanti : `clearInterval` est appelé sur unmount ou si `active`
 * passe à false.
 */
export function useStripeActivationPolling({
  active,
  userId,
  refreshSubscription,
  onActivating,
  onActivated,
  onTimeout,
}: {
  active: boolean;
  userId: string | null;
  refreshSubscription: (userId: string) => Promise<boolean>;
  onActivating: (b: boolean) => void;
  onActivated: () => void;
  onTimeout: () => void;
}) {
  useEffect(() => {
    if (!active || !userId) return;
    onActivating(true);
    const deadline = Date.now() + POLL_DURATION_MS;
    let timer: ReturnType<typeof setInterval> | null = setInterval(async () => {
      const ok = await refreshSubscription(userId);
      if (ok) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        onActivating(false);
        onActivated();
      } else if (Date.now() > deadline) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        onActivating(false);
        onTimeout();
      }
    }, POLL_INTERVAL_MS);
    return () => {
      if (timer) clearInterval(timer);
    };
    // Les callbacks sont stables (setState React) ou capturent la closure
    // courante. On dépend uniquement du couple (active, userId).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId]);
}
