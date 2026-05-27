"use client";

// ⚠️ COMPOSANT DE DEBUG TEMPORAIRE — à retirer avec le fix final du bug scan
// caméra multi-factures (issue runtime A vs C). Voir logs [batch-diag].
//
// Affiche à l'écran (sans DevTools) tous les console.log/console.error dont le
// 1er argument est une string commençant par "[batch-diag]". Utile car le
// remote debugging USB ne marche pas sur le Pixel de Lucas.
//
// Activation : env var client NEXT_PUBLIC_BATCH_DIAG = "true" (inlinée au build
// → nécessite un redeploy Vercel pour basculer). Sinon le composant rend null.
//
// - Monkey-patch console.log/error AU MONTAGE, restauré AU DÉMONTAGE.
// - N'intercepte QUE les logs "[batch-diag]" ; tous les autres logs appellent
//   quand même l'original (observabilité préservée).
// - Persiste dans localStorage "batch-diag-logs" (max 100, FIFO) → survit à un
//   refresh / crash PWA.

import { useEffect, useState } from "react";

const LS_KEY = "batch-diag-logs";
const MAX_ENTRIES = 100;
const PREFIX = "[batch-diag]";

type DiagEntry = { t: number; level: "log" | "error"; msg: string; data: string };

/** Sérialisation sûre : gère les Error et les références circulaires. */
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_k, v) => {
        if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
        if (typeof v === "object" && v !== null) {
          if (seen.has(v as object)) return "[circular]";
          seen.add(v as object);
        }
        return v;
      },
      2,
    );
  } catch {
    try { return String(value); } catch { return "[unserializable]"; }
  }
}

function fmtTime(t: number): string {
  const d = new Date(t);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

export function DebugOverlay() {
  const enabled = process.env.NEXT_PUBLIC_BATCH_DIAG === "true";
  const [entries, setEntries] = useState<DiagEntry[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Hydratation depuis localStorage.
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DiagEntry[];
        if (Array.isArray(parsed)) setEntries(parsed.slice(-MAX_ENTRIES));
      }
    } catch { /* ignore */ }

    const origLog = console.log;
    const origError = console.error;

    const capture = (level: "log" | "error", args: unknown[]) => {
      const first = args[0];
      if (typeof first !== "string" || !first.startsWith(PREFIX)) return;
      const entry: DiagEntry = {
        t: Date.now(),
        level,
        msg: first,
        data: args.length > 1 ? safeStringify(args.length === 2 ? args[1] : args.slice(1)) : "",
      };
      setEntries((prev) => {
        const next = [...prev, entry].slice(-MAX_ENTRIES); // FIFO
        try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* quota */ }
        return next;
      });
    };

    // Patch : on appelle TOUJOURS l'original (ne casse pas le reste), puis on
    // capture uniquement les "[batch-diag]".
    console.log = (...args: unknown[]) => { origLog(...(args as [])); capture("log", args); };
    console.error = (...args: unknown[]) => { origError(...(args as [])); capture("error", args); };

    return () => {
      console.log = origLog;
      console.error = origError;
    };
  }, [enabled]);

  if (!enabled) return null;

  const clearAll = () => {
    setEntries([]);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard indispo */ }
  };

  return (
    <div
      style={{ opacity: 0.85, maxWidth: 380, maxHeight: "40vh" }}
      className="fixed bottom-2 right-2 z-[9999] w-[380px] max-w-[92vw] rounded-lg bg-black text-white font-mono text-[11px] leading-tight shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-white/20 flex-shrink-0">
        <span className="font-semibold">[batch-diag] {entries.length}</span>
        <div className="flex items-center gap-1.5">
          <button onClick={copyAll} className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25">
            {copied ? "Copié ✓" : "Copier tout"}
          </button>
          <button onClick={clearAll} className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25">
            Effacer
          </button>
        </div>
      </div>
      <div className="overflow-y-auto px-2 py-1.5 space-y-1.5" style={{ maxHeight: "calc(40vh - 32px)" }}>
        {entries.length === 0 ? (
          <p className="text-white/50">En attente de logs [batch-diag]…</p>
        ) : (
          [...entries].reverse().map((e, i) => (
            <div key={`${e.t}-${i}`} className="border-b border-white/10 pb-1">
              <div className={e.level === "error" ? "text-rose-300" : "text-emerald-300"}>
                <span className="text-white/50">{fmtTime(e.t)}</span> {e.msg}
              </div>
              {e.data && <pre className="whitespace-pre-wrap break-all text-white/80 mt-0.5">{e.data}</pre>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
