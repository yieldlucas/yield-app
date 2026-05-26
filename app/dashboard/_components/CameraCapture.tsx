"use client";

// Caméra intégrée (getUserMedia) — remplace <input type="file" capture>, qui
// échoue en silence sur certains Android (Pixel 10) et en PWA installée.
//
// UX permission (le point délicat) :
//   - granted  → on démarre la caméra direct (aucun tap superflu).
//   - prompt   → écran d'amorce "Activer la caméra" : le tap déclenche
//                getUserMedia DANS un geste utilisateur → la demande navigateur
//                s'affiche de façon fiable (1 seul tap "Autoriser").
//   - denied   → écran de récupération avec instructions EXACTES (PWA installée
//                vs navigateur) + import de photo en secours.
//
// La photo capturée est convertie en File JPEG et renvoyée via onCapture.
// onPickFile = secours (ouvre le sélecteur de fichiers du parent).

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Camera as CameraIcon, FolderOpen, ShieldCheck } from "lucide-react";

type Phase = "loading" | "prime" | "live" | "denied" | "unavailable";

export function CameraCapture({
  open,
  onClose,
  onCapture,
  onPickFile,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onPickFile: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari "Sur l'écran d'accueil"
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setPhase("loading");
    setReady(false);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPhase("unavailable");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("live");
      // Le <video> est monté dans la phase "live" → on attache au prochain tick.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") setPhase("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError")
        setPhase("unavailable");
      else setPhase("denied"); // par défaut on guide vers la récupération permission
    }
  };

  // À l'ouverture : on route selon l'état de permission connu (Permissions API).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);

    (async () => {
      // Permissions API (Chrome/Android la supporte) : évite d'appeler
      // getUserMedia quand c'est déjà 'denied' (ça échouerait en silence),
      // et permet de démarrer direct quand c'est déjà 'granted'.
      try {
        const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
        if (perms?.query) {
          // "camera" n'est pas dans le type PermissionName standard du DOM lib.
          const status = await perms.query({ name: "camera" as PermissionName });
          if (cancelled) return;
          if (status.state === "granted") { void startCamera(); return; }
          if (status.state === "denied") { setPhase("denied"); return; }
          setPhase("prime"); // 'prompt'
          return;
        }
      } catch {
        // API indisponible (ex: iOS Safari) → on tombe sur l'amorce.
      }
      if (!cancelled) setPhase("prime");
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setBusy(false); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          setBusy(false);
          if (!blob) return;
          onCapture(new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92,
      );
    } catch {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 text-white/90 flex-shrink-0">
            <span className="text-sm font-semibold">Scanner un bon de livraison</span>
            <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-full hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {/* ── Amorce : explique + déclenche la demande dans un geste ── */}
            {phase === "prime" && (
              <div className="px-8 text-center max-w-sm">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <CameraIcon size={26} className="text-white/80" />
                </div>
                <p className="text-white font-semibold text-lg mb-2">Activer la caméra</p>
                <p className="text-white/60 text-sm leading-relaxed mb-6">
                  Yield ouvre l&apos;appareil photo pour scanner vos bons de livraison.
                  Votre navigateur va demander l&apos;autorisation : touchez «&nbsp;Autoriser&nbsp;».
                </p>
                <button
                  onClick={() => void startCamera()}
                  className="inline-flex items-center gap-2 btn-primary text-white font-semibold text-sm px-6 py-3 rounded-xl"
                >
                  <CameraIcon size={16} /> Activer la caméra
                </button>
                <button onClick={onPickFile} className="block mx-auto mt-4 text-white/50 text-sm underline">
                  Importer une photo à la place
                </button>
              </div>
            )}

            {/* ── Refusé : récupération guidée ── */}
            {phase === "denied" && (
              <div className="px-7 text-center max-w-sm">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <ShieldCheck size={26} className="text-white/70" />
                </div>
                <p className="text-white font-semibold mb-2">Caméra bloquée</p>
                <div className="text-white/65 text-sm leading-relaxed mb-5 text-left bg-white/5 rounded-xl p-4">
                  {isStandalone ? (
                    <>
                      <p className="mb-2 font-medium text-white/80">
                        Pour une app installée, la permission caméra se règle dans <strong>Chrome</strong>,
                        pas dans les réglages de l&apos;app (vous n&apos;y verrez que «&nbsp;Notifications&nbsp;») :
                      </p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Ouvrez <strong>Chrome</strong> (le navigateur).</li>
                        <li>Menu <strong>⋮</strong> → <strong>Paramètres</strong> → <strong>Paramètres des sites</strong>.</li>
                        <li><strong>Appareil photo</strong> → trouvez <strong>yieldapp.fr</strong> (souvent dans «&nbsp;Bloqués&nbsp;») → <strong>Autoriser</strong>.</li>
                        <li>Rouvrez Yield et rescannez. Le plus simple : utilisez Yield <strong>dans un onglet Chrome</strong>, où l&apos;autorisation est plus directe.</li>
                      </ol>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 font-medium text-white/80">Pour réactiver (une seule fois) :</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Touchez l&apos;icône à gauche de l&apos;adresse (cadenas / réglages).</li>
                        <li><strong>Autorisations</strong> → <strong>Appareil photo</strong> → <strong>Autoriser</strong>.</li>
                        <li>Rechargez la page et rescannez.</li>
                      </ol>
                    </>
                  )}
                </div>
                <button
                  onClick={onPickFile}
                  className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-5 py-2.5 rounded-xl"
                >
                  <FolderOpen size={16} /> Importer une photo
                </button>
                <button onClick={() => void startCamera()} className="block mx-auto mt-3 text-white/50 text-sm underline">
                  J&apos;ai autorisé — réessayer
                </button>
              </div>
            )}

            {/* ── Caméra indisponible ── */}
            {phase === "unavailable" && (
              <div className="px-8 text-center max-w-sm">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <CameraIcon size={26} className="text-white/70" />
                </div>
                <p className="text-white font-semibold mb-2">Caméra indisponible</p>
                <p className="text-white/60 text-sm leading-relaxed mb-6">
                  Pas de souci : prenez la photo avec votre appli Appareil photo, puis importez-la.
                </p>
                <button
                  onClick={onPickFile}
                  className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-5 py-2.5 rounded-xl"
                >
                  <FolderOpen size={16} /> Importer une photo
                </button>
              </div>
            )}

            {/* ── Aperçu live ── */}
            {(phase === "live" || phase === "loading") && (
              <>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onCanPlay={() => setReady(true)}
                  className="w-full h-full object-contain"
                />
                {!ready && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                {ready && (
                  <div aria-hidden className="absolute inset-6 border-2 border-white/30 rounded-2xl pointer-events-none" />
                )}
              </>
            )}
          </div>

          {/* Barre d'action bas — uniquement en mode live */}
          {phase === "live" && (
            <div className="flex-shrink-0 px-6 pb-8 pt-4 flex items-center justify-between">
              <button
                onClick={onPickFile}
                aria-label="Importer une photo"
                className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                title="Importer une photo"
              >
                <FolderOpen size={20} />
              </button>
              <button
                onClick={capture}
                disabled={!ready || busy}
                aria-label="Prendre la photo"
                className="rounded-full bg-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
                style={{ width: 72, height: 72 }}
              >
                <span className="rounded-full border-4 border-slate-900/80" style={{ width: 58, height: 58 }} />
              </button>
              <div className="w-12 h-12" />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
