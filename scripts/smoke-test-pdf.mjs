// Smoke test du rendu PDF — vérifie que les cas extrêmes (libellés longs,
// prix nuls, caractères spéciaux ajoutés par le prompt Vision optimisé) ne
// font pas crasher renderToBuffer et produisent un PDF valide.
//
// Usage :
//   npx tsx scripts/smoke-test-pdf.mjs        # nécessite `npm i -D tsx`
//   ou via Next runtime : `npm run dev` puis ouvrir un PDF dans le navigateur
//
// Sortie : /tmp/yield-pdf-smoke.pdf (à ouvrir manuellement pour vérif visuelle)

import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { writeFileSync } from "node:fs";

const { InvoicePdf } = await import("../lib/pdf/InvoicePdf.tsx");

const data = {
  supplierName:
    "Société Coopérative Agricole de Producteurs Maraîchers du Sud-Ouest – Filière Bio Certifiée AB Œuf-fournisseur du Café Brûlé",
  invoiceNumber: "BL-2026-00042-AB-VERY-LONG-NUMBER-SHOULD-BE-TRUNCATED",
  invoiceDate: "2026-05-06",
  totalHt: 1234.56,
  variationPct: 12.7,
  generatedAt: new Date().toISOString(),
  restaurantName: "Le Bœuf Cœur d'Œuf — Restaurant",
  items: [
    {
      label:
        "Filet de bœuf charolais français race à viande extra label rouge AOC élevage en plein air haut de gamme",
      quantity: 2.5,
      unit: "kg",
      unitPriceHt: 28.9,
      totalPriceHt: 72.25,
      vatRate: 5.5,
      previousPrice: 24.5,
      corrected: false,
    },
    {
      label: "Œufs fermiers bio (lot)",
      quantity: 12,
      unit: "piece",
      unitPriceHt: null, // ← prix null : doit afficher "0,00 EUR*" + footnote
      totalPriceHt: null,
      vatRate: 5.5,
      previousPrice: null,
      corrected: true,
    },
    {
      label: "Café",
      quantity: 1,
      unit: "kg",
      unitPriceHt: 18.0,
      totalPriceHt: 18.0,
      vatRate: 20,
      previousPrice: 16.5,
      corrected: false,
    },
  ],
};

const buffer = await renderToBuffer(createElement(InvoicePdf, { data }));
const out = "/tmp/yield-pdf-smoke.pdf";
writeFileSync(out, buffer);
console.log(`✓ PDF généré : ${out} (${buffer.length} bytes)`);
console.log("  Vérifs manuelles :");
console.log("  - Le supplierName et invoiceNumber doivent être tronqués avec « … »");
console.log("  - La 2e ligne (Œufs) doit afficher « 0,00 EUR* » en gris");
console.log("  - Une note en bas de table doit expliquer l'astérisque");
console.log("  - Les ligatures Œ et accents doivent s'afficher proprement");
