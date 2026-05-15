// [audit-fix C4] script de backfill manuel pour la colonne name_normalized
// ajoutée par la migration 025.
//
// Usage :
//   npx tsx scripts/backfill-product-names.ts                 # mode dry-run par défaut
//   npx tsx scripts/backfill-product-names.ts --apply         # exécute réellement
//
// Pré-requis env vars (.env.local ou shell) :
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (pour bypasser RLS et UPDATE en masse)
//
// Idempotent : on peut le relancer, les rows déjà à jour sont skippées.
//
// IMPORTANT — duplication contrôlée de normalizeProductLabel :
// La même fonction existe dans supabase/functions/process-invoice/index.ts
// (Deno, edge function). Elle ne peut pas être importée ici (Node ne peut
// pas charger un module Deno). Toute modification de la logique de
// normalisation doit être faite EN SYNCHRONE dans les deux fichiers.
// Voir aussi unit_conversion_factor (SQL/JS/Deno) pour le même pattern.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Env vars manquantes : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const DRY_RUN = !process.argv.includes("--apply");

// ─── Fonction de normalisation (miroir exact de l'edge function) ────────────
const MAX_LABEL_LENGTH = 500;

function normalizeProductLabel(rawLabel: string | null | undefined): string {
  if (!rawLabel) return "";
  const capped = rawLabel.length > MAX_LABEL_LENGTH ? rawLabel.slice(0, MAX_LABEL_LENGTH) : rawLabel;
  if (capped.trim() === "") return "";
  return capped
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/(\d)(ml|cl|kg|l|g|pc|piece)\b/gi, "$1 $2")
    .replace(/[,\-_;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Pagination + backfill ─────────────────────────────────────────────────
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`Backfill name_normalized — mode: ${DRY_RUN ? "DRY-RUN" : "APPLY"}`);

  const PAGE_SIZE = 500;
  let offset = 0;
  let total = 0;
  let toUpdate = 0;
  let updated = 0;
  let skipped = 0;
  let alreadyCorrect = 0;

  while (true) {
    const { data: products, error } = await sb
      .from("products")
      .select("id, name, name_normalized")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("Erreur lecture products:", error.message);
      process.exit(1);
    }
    if (!products || products.length === 0) break;

    total += products.length;

    for (const p of products) {
      const computed = normalizeProductLabel(p.name);
      if (computed === "") {
        // Label illisible — on ne touche pas (la colonne reste NULL). Le code
        // edge function gère ce cas via review_reason "empty_label" lors des
        // nouveaux scans. Le backfill ne tente pas de "réparer" ces rows.
        skipped++;
        continue;
      }
      if (p.name_normalized === computed) {
        alreadyCorrect++;
        continue;
      }
      toUpdate++;
      if (!DRY_RUN) {
        const { error: upErr } = await sb
          .from("products")
          .update({ name_normalized: computed })
          .eq("id", p.id);
        if (upErr) {
          console.error(`Erreur update ${p.id}:`, upErr.message);
        } else {
          updated++;
        }
      } else {
        console.log(`  [DRY] ${p.id}: "${p.name}" → "${computed}"`);
      }
    }

    if (products.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log("─── Résumé ───");
  console.log(`Total products lus      : ${total}`);
  console.log(`Déjà corrects (skip)    : ${alreadyCorrect}`);
  console.log(`Label vide (skip)       : ${skipped}`);
  console.log(`À mettre à jour         : ${toUpdate}`);
  if (!DRY_RUN) {
    console.log(`Effectivement mis à jour : ${updated}`);
    if (updated !== toUpdate) {
      console.warn(`⚠ ${toUpdate - updated} updates ont échoué — voir logs ci-dessus`);
    }
  } else {
    console.log("(Mode DRY-RUN — relancer avec --apply pour exécuter)");
  }
}

main().catch((err) => {
  console.error("Crash:", err);
  process.exit(1);
});
