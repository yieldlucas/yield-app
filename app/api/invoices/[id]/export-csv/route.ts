import { NextRequest, NextResponse } from "next/server";
import { authorizeExport } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-admin";
import { apiErrorResponse, internal, notFound } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Échappement CSV RFC 4180 — double-quote les valeurs contenant ; " ou \n.
function csvEscape(raw: unknown): string {
  const s = raw == null ? "" : String(raw);
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const fr = (n: number, d = 2) => n.toFixed(d).replace(".", ",");

/**
 * Export CSV d'une facture (toutes ses lignes).
 * Auth : Bearer ou `?t=<signed_token>` scopé sur invoiceId.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: invoiceId } = await params;
    const userId = await authorizeExport(req, invoiceId);
    const sb = getServiceClient();

    const { data: inv, error: invErr } = await sb
      .from("invoices")
      .select(`
        invoice_date, invoice_number,
        supplier:suppliers(name),
        restaurant:restaurants(owner_id),
        items:invoice_items(raw_label, quantity, unit, unit_price_ht, total_price_ht, vat_rate)
      `)
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr) throw internal("Erreur lors de la lecture de la facture", invErr);

    type Row = {
      invoice_date: string | null;
      invoice_number: string | null;
      supplier: { name: string } | null;
      restaurant: { owner_id: string } | null;
      items: Array<{
        raw_label: string;
        quantity: number | null;
        unit: string | null;
        unit_price_ht: number | null;
        total_price_ht: number | null;
        vat_rate: number | null;
      }>;
    };
    const r = inv as unknown as Row | null;
    if (!r || !r.restaurant || r.restaurant.owner_id !== userId) {
      throw notFound("Facture introuvable");
    }

    const header = ["Date", "Fournisseur", "BL", "Produit", "Quantite", "Unite", "PU HT", "Total HT", "TVA %", "TVA", "TTC"];
    const lines: string[] = [header.join(";")];

    for (const it of r.items ?? []) {
      const ht = Number(it.total_price_ht ?? 0);
      const vatRate = Number(it.vat_rate ?? 0);
      const vat = ht * (vatRate / 100);
      const ttc = ht + vat;
      lines.push(
        [
          csvEscape(r.invoice_date ?? ""),
          csvEscape(r.supplier?.name ?? ""),
          csvEscape(r.invoice_number ?? ""),
          csvEscape(it.raw_label ?? ""),
          csvEscape(fr(Number(it.quantity ?? 0), 3)),
          csvEscape(it.unit ?? ""),
          csvEscape(fr(Number(it.unit_price_ht ?? 0))),
          csvEscape(fr(ht)),
          csvEscape(fr(vatRate, 1)),
          csvEscape(fr(vat)),
          csvEscape(fr(ttc)),
        ].join(";"),
      );
    }

    // BOM UTF-8 pour qu'Excel FR ouvre proprement les accents.
    const csv = "﻿" + lines.join("\r\n");
    const supplierSlug = (r.supplier?.name ?? "facture")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30);
    const dateSlug = (r.invoice_date ?? new Date().toISOString()).slice(0, 10);
    const filename = `yield-${supplierSlug}-${dateSlug}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "invoices/export-csv");
  }
}
