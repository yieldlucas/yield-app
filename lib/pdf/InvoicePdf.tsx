// PDF généré via @react-pdf/renderer (rendu côté serveur Node).
// Layout pro/sobre — proche d'une facture comptable classique.
// Le route handler appelle `renderToBuffer(<InvoicePdf data={...}/>)` puis stream.

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export type InvoicePdfData = {
  supplierName: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  totalHt: number | null;
  variationPct: number | null;
  generatedAt: string;
  restaurantName: string | null;
  items: {
    label: string;
    quantity: number;
    unit: string | null;
    unitPriceHt: number;
    totalPriceHt: number;
    vatRate: number | null;
    previousPrice: number | null;
    corrected: boolean;
  }[];
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1e293b" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, paddingBottom: 15, borderBottom: "1pt solid #e2e8f0" },
  brand: { fontSize: 16, fontWeight: "bold", color: "#2563eb" },
  brandSub: { fontSize: 8, color: "#94a3b8", marginTop: 2 },
  metaBlock: { textAlign: "right" },
  metaLabel: { fontSize: 7, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 },
  metaValue: { fontSize: 10, color: "#1e293b", marginTop: 1 },

  supplierTitle: { fontSize: 18, fontWeight: "bold", marginTop: 8, marginBottom: 4 },
  supplierMeta: { fontSize: 9, color: "#64748b", marginBottom: 18 },

  totalCard: { flexDirection: "row", justifyContent: "space-between", padding: 12, backgroundColor: "#f8fafc", borderRadius: 6, marginBottom: 16 },
  totalLabel: { fontSize: 8, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  totalValue: { fontSize: 22, fontWeight: "bold", marginTop: 2 },
  variation: { fontSize: 11, fontWeight: "bold", padding: 4, paddingLeft: 8, paddingRight: 8, borderRadius: 12, alignSelf: "center" },

  tableHead: { flexDirection: "row", borderBottom: "1pt solid #cbd5e1", paddingBottom: 6, marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingTop: 6, paddingBottom: 6, borderBottom: "0.5pt solid #f1f5f9" },
  th: { fontSize: 8, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  cellLabel:    { width: "44%", paddingRight: 8 },
  cellQty:      { width: "14%", textAlign: "right", paddingRight: 8 },
  cellPrice:    { width: "16%", textAlign: "right", paddingRight: 8 },
  cellTotal:    { width: "16%", textAlign: "right", paddingRight: 8 },
  cellVar:      { width: "10%", textAlign: "right" },

  itemLabel: { fontSize: 10, fontWeight: "bold" },
  itemPrev: { fontSize: 7, color: "#94a3b8", marginTop: 1 },
  corrected: { fontSize: 7, color: "#10b981", marginTop: 1 },

  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 7, color: "#94a3b8", textAlign: "center", borderTop: "0.5pt solid #e2e8f0", paddingTop: 8 },
});

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR";

const variationColor = (pct: number | null) => {
  if (pct == null) return "#94a3b8";
  if (pct >= 7) return "#ef4444";
  if (pct < 0) return "#10b981";
  return "#64748b";
};
const variationBg = (pct: number | null) => {
  if (pct == null) return "#f1f5f9";
  if (pct >= 7) return "#fee2e2";
  if (pct < 0) return "#d1fae5";
  return "#f1f5f9";
};

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header marque + meta */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>YIELD</Text>
            <Text style={styles.brandSub}>Pilotage marges restauration</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Document généré</Text>
            <Text style={styles.metaValue}>
              {new Date(data.generatedAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
            </Text>
            {data.restaurantName ? (
              <>
                <Text style={[styles.metaLabel, { marginTop: 6 }]}>Restaurant</Text>
                <Text style={styles.metaValue}>{data.restaurantName}</Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Fournisseur + meta facture */}
        <Text style={styles.supplierTitle}>{data.supplierName || "Fournisseur inconnu"}</Text>
        <Text style={styles.supplierMeta}>
          {data.invoiceNumber ? `BL n° ${data.invoiceNumber}  ·  ` : ""}
          {data.invoiceDate
            ? new Date(data.invoiceDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
            : "Date non renseignée"}
        </Text>

        {/* Total card */}
        <View style={styles.totalCard}>
          <View>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{data.totalHt != null ? fmt(data.totalHt) : "—"}</Text>
          </View>
          <Text style={[styles.variation, {
            color: variationColor(data.variationPct),
            backgroundColor: variationBg(data.variationPct),
          }]}>
            {data.variationPct == null
              ? "—"
              : `${data.variationPct >= 7 ? "↗" : data.variationPct < 0 ? "↘" : "→"} ${data.variationPct > 0 ? "+" : ""}${data.variationPct.toFixed(1)}%`}
          </Text>
        </View>

        {/* Table header */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.cellLabel]}>Produit</Text>
          <Text style={[styles.th, styles.cellQty]}>Quantité</Text>
          <Text style={[styles.th, styles.cellPrice]}>Prix unit. HT</Text>
          <Text style={[styles.th, styles.cellTotal]}>Total HT</Text>
          <Text style={[styles.th, styles.cellVar]}>Var.</Text>
        </View>

        {/* Rows */}
        {data.items.map((it, i) => {
          const variationPct = it.previousPrice && it.previousPrice > 0
            ? ((it.unitPriceHt - it.previousPrice) / it.previousPrice) * 100
            : null;
          return (
            <View key={i} style={styles.tableRow} wrap={false}>
              <View style={styles.cellLabel}>
                <Text style={styles.itemLabel}>{it.label}</Text>
                {it.previousPrice != null ? (
                  <Text style={styles.itemPrev}>Prix précédent : {fmt(it.previousPrice)}</Text>
                ) : null}
                {it.corrected ? <Text style={styles.corrected}>Corrigé manuellement</Text> : null}
              </View>
              <Text style={styles.cellQty}>
                {it.quantity.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}{it.unit ? ` ${it.unit}` : ""}
              </Text>
              <Text style={styles.cellPrice}>{fmt(it.unitPriceHt)}</Text>
              <Text style={styles.cellTotal}>{fmt(it.totalPriceHt)}</Text>
              <Text style={[styles.cellVar, { color: variationColor(variationPct), fontWeight: "bold" }]}>
                {variationPct == null ? "—" : `${variationPct > 0 ? "+" : ""}${variationPct.toFixed(1)}%`}
              </Text>
            </View>
          );
        })}

        <Text style={styles.footer} fixed>
          Document généré par Yield · yieldapp.fr · Données conservées sur serveurs européens (Supabase EU-Stockholm)
        </Text>
      </Page>
    </Document>
  );
}
