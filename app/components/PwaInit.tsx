"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

// ─── Service Worker registration ─────────────────────────
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              // Nouvelle version activée au prochain chargement — pas de prompt intrusif
            });
          });
        })
        .catch((err) => console.warn("[SW] Registration failed:", err));
    });
  }, []);

  return null;
}

// ─── PWA Install Banner ───────────────────────────────────
// Affiché sur iOS (instructions manuelles) et Android (prompt natif)

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Déjà installé ? Ne pas afficher
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    // Déjà dismissé dans cette session ?
    if (sessionStorage.getItem("pwa-banner-dismissed")) {
      setDismissed(true);
      return;
    }

    // iOS : pas d'event beforeinstallprompt, instructions manuelles
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    // Android / Chrome : intercept le prompt natif
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  if (installed || dismissed || (!prompt && !isIOS)) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-40 max-w-sm mx-auto md:hidden">
      <div className="glass rounded-2xl p-4 border border-blue-100 shadow-card">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 btn-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <Download size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 font-semibold text-sm mb-1">
              Installer YIELD
            </p>
            {isIOS ? (
              <p className="text-slate-500 text-xs leading-relaxed">
                Ajoutez YIELD à votre écran d&apos;accueil : appuyez sur{" "}
                <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                  Partager
                </span>{" "}
                <span aria-hidden="true">⎋</span> puis{" "}
                <span className="text-blue-600 font-medium">
                  «&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;»
                </span>.
              </p>
            ) : (
              <p className="text-slate-500 text-xs">
                Un tap, un scan, un rendement préservé. Même hors connexion dans votre cuisine.
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-700 flex-shrink-0 mt-0.5 transition-colors"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {!isIOS && (
          <button
            onClick={handleInstall}
            className="btn-primary w-full mt-3 text-white text-sm font-semibold py-2.5 rounded-xl"
          >
            Installer l&apos;application
          </button>
        )}
      </div>
    </div>
  );
}
