// [audit-fix R3] vérifie que les pages légales ne contiennent plus de
// placeholder `[À COMPLÉTER : ...]` avant un déploiement production.
//
// Comportement (4 cas) :
//   - Aucun placeholder trouvé → succès silencieux (exit 0)
//   - Placeholders + dev/preview (NODE_ENV != production) → warning + exit 0
//   - Placeholders + production + NEXT_PUBLIC_LEGAL_DRAFT=true → warning
//     explicite (mode draft, le bandeau LegalDraftBanner s'affiche côté
//     front) + exit 0
//   - Placeholders + production + pas en mode draft → erreur + exit 1
//     (le build Vercel échoue, déploiement bloqué). Message indique les
//     2 voies de déblocage : remplir les placeholders OU activer le mode
//     draft via NEXT_PUBLIC_LEGAL_DRAFT.
//
// Branché en hook prebuild dans package.json. Pour vérifier manuellement :
//   npm run check:legal
//   NODE_ENV=production npm run check:legal                          (bloque)
//   NODE_ENV=production NEXT_PUBLIC_LEGAL_DRAFT=true npm run check:legal  (passe)
//
// Pattern recherché : "[À COMPLÉTER :" (avec À accentué). Lecture explicite
// UTF-8 pour la portabilité Linux/macOS. Fallback ASCII "[A COMPLETER :" pour
// les rares cas où un dev aurait saisi sans accent.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const LEGAL_FILES = [
  "app/legal/page.tsx",
  "app/terms/page.tsx",
  "app/privacy/page.tsx",
];

const PLACEHOLDER_PATTERNS = [
  "[À COMPLÉTER :",  // forme canonique avec accent
  "[A COMPLETER :",  // fallback ASCII (si saisi sans accent par erreur)
];

type Finding = { file: string; line: number; preview: string };

async function scanFile(path: string): Promise<Finding[]> {
  const absolute = join(process.cwd(), path);
  const content = await readFile(absolute, { encoding: "utf-8" });
  const findings: Finding[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (line.includes(pattern)) {
        findings.push({
          file: path,
          line: i + 1,
          preview: line.trim().slice(0, 140),
        });
        break;  // une occurrence par ligne suffit
      }
    }
  }
  return findings;
}

async function main(): Promise<void> {
  // Fix audit R3 — mode draft via env var : NEXT_PUBLIC_LEGAL_DRAFT=true
  // autorise un déploiement production avec placeholders résiduels, à
  // condition que le bandeau LegalDraftBanner s'affiche côté front.
  const isProduction = process.env.NODE_ENV === "production";
  const isDraft = process.env.NEXT_PUBLIC_LEGAL_DRAFT === "true";

  const allFindings: Finding[] = [];
  for (const file of LEGAL_FILES) {
    try {
      const findings = await scanFile(file);
      allFindings.push(...findings);
    } catch (err) {
      // Fichier absent = anomalie : on signale mais on ne bloque pas le build
      // (on ne veut pas qu'un refacto futur de routing casse silencieusement
      // un build prod sans rapport avec les placeholders légaux eux-mêmes).
      console.warn(`[check:legal] Fichier introuvable, skip : ${file} (${(err as Error).message})`);
    }
  }

  if (allFindings.length === 0) {
    console.log("[check:legal] ✓ Aucun placeholder résiduel dans les pages légales.");
    return;
  }

  // Affichage groupé par fichier pour lisibilité
  console.error("");
  console.error(`[check:legal] ⚠ ${allFindings.length} placeholder(s) trouvé(s) dans les pages légales :`);
  console.error("");
  const byFile = new Map<string, Finding[]>();
  for (const f of allFindings) {
    const arr = byFile.get(f.file) ?? [];
    arr.push(f);
    byFile.set(f.file, arr);
  }
  for (const [file, items] of byFile) {
    console.error(`  ${file} (${items.length}) :`);
    for (const item of items) {
      console.error(`    L${item.line.toString().padStart(3, " ")} : ${item.preview}`);
    }
    console.error("");
  }

  // Fix audit R3 — mode draft via env var
  if (isProduction && isDraft) {
    console.warn("[check:legal] Mode draft (NEXT_PUBLIC_LEGAL_DRAFT=true) : build autorisé malgré les placeholders.");
    console.warn("[check:legal]   Le bandeau LegalDraftBanner s'affichera sur /legal, /terms et /privacy.");
    console.warn("[check:legal]   Une fois les placeholders remplis (post-réception SIRET), retirer la");
    console.warn("[check:legal]   variable NEXT_PUBLIC_LEGAL_DRAFT des env vars Vercel pour repasser au");
    console.warn("[check:legal]   contrôle strict. Voir docs/deployment-notes.md section \"Fix audit R3\".");
    return;
  }

  if (isProduction) {
    console.error("[check:legal] ✗ NODE_ENV=production : déploiement bloqué.");
    console.error("[check:legal]   Deux voies de déblocage :");
    console.error("[check:legal]     1. Remplacer les placeholders ci-dessus puis relancer le build.");
    console.error("[check:legal]     2. Passer NEXT_PUBLIC_LEGAL_DRAFT=true (mode draft, bandeau visible).");
    console.error("[check:legal]   Voir docs/deployment-notes.md section \"Fix audit R3\".");
    process.exit(1);
  }

  console.warn("[check:legal] Mode dev/preview : warning seul, build autorisé.");
  console.warn("[check:legal] Remplacer les placeholders avant le déploiement production.");
}

main().catch((err) => {
  console.error("[check:legal] Crash inattendu :", err);
  process.exit(1);
});
