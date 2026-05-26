"use client";

// Caméra intégrée (getUserMedia) — remplace le déclenchement via
// <input type="file" capture>, qui échoue en silence sur certains Android
// (ex: Pixel 10) et dans les PWA installées. getUserMedia :
//   - demande explicitement la permission caméra (prompt clair),
//   - affiche un aperçu live + bouton de capture,
//   - marche en onglet ET en PWA installée (standalone),
//   - ne dépend pas de l'attribut `capture`.
//
// La photo capturée est convertie en File JPEG et renvoyée via onCapture, qui
// la pousse dans le même flux (stack → batch) que l'import de fichier.
// Fallback "Choisir un fichier" (onPickFile) si la caméra est indisponible
// ou refusée — on ne bloque jamais le chef.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Camera as CameraIcon, FolderOpen, RotateCcw } from "lucide-react";

type CamError = null | "denied" | "unsupported" | "notfound" | "error";

export function CameraCapture({
  open,
  onClose,
  onCapture,
  onPickFile,
}: {
  open: boolean;
  onClose: () => void;
  /** Reçoit la photo capturée (JPEG). Le parent l'ajoute au stack. */
  onCapture: (file: File) => void;
  /** Fallback : ouvre le sélecteur de fichiers (input galerie du parent). */
  onPickFile: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<CamError>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  // Démarrage / arrêt du flux caméra à l'ouverture/fermeture.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setReady(false);

    const stopStream = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("unsupported");
        return;
      }
      try {
        // facingMode "environment" (caméra arrière) en idéal — fallback caméra
        // par défaut si l'appareil n'a pas de caméra arrière dédiée.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        const name = (e as DOMException)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") setError("denied");
        else if (name === "NotFoundError" || name === "OverconstrainedError") setError("notfound");
        else setError("error");
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
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
          const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
          onCapture(file);
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

          {/* Zone caméra / erreur */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {error ? (
              <div className="px-8 text-center max-w-sm">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <CameraIcon size={26} className="text-white/70" />
                </div>
                <p className="text-white font-semibold mb-2">
                  {error === "denied"
                    ? "Accès caméra refusé"
                    : error === "notfound"
                      ? "Aucune caméra détectée"
                      : "Caméra indisponible"}
                </p>
                <p className="text-white/60 text-sm leading-relaxed mb-6">
                  {error === "denied"
                    ? "Autorisez la caméra dans les réglages de votre navigateur, ou importez une photo déjà prise."
                    : "Pas de souci : prenez la photo avec votre appli Appareil photo, puis importez-la."}
                </p>
                <button
                  onClick={onPickFile}
                  className="inline-flex items-center gap-2 bg-white text-slate-900 font-semibold text-sm px-5 py-2.5 rounded-xl"
                >
                  <FolderOpen size={16} /> Importer une photo
                </button>
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                {!ready && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                {/* Cadre guide */}
                {ready && (
                  <div aria-hidden className="absolute inset-6 border-2 border-white/30 rounded-2xl pointer-events-none" />
                )}
              </>
            )}
          </div>

          {/* Barre d'action bas */}
          {!error && (
            <div className="flex-shrink-0 px-6 pb-8 pt-4 flex items-center justify-between">
              <button
                onClick={onPickFile}
                aria-label="Importer une photo"
                className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                title="Importer une photo"
              >
                <FolderOpen size={20} />
              </button>

              {/* Déclencheur */}
              <button
                onClick={capture}
                disabled={!ready || busy}
                aria-label="Prendre la photo"
                className="w-18 h-18 rounded-full bg-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
                style={{ width: 72, height: 72 }}
              >
                <span className="w-16 h-16 rounded-full border-4 border-slate-900/80" style={{ width: 60, height: 60 }} />
              </button>

              {/* Espace symétrique (pas de switch caméra en V1) */}
              <div className="w-12 h-12 flex items-center justify-center text-white/40">
                <RotateCcw size={20} className="opacity-0" />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
