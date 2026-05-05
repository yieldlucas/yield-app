import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf, type InvoicePdfData } from "@/lib/pdf/InvoicePdf";
import { authorizeExport } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-admin";
import { apiErrorResponse, internal, notFound } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Génère un PDF d'une facture analysée et le stream en attachment.
 *
 * Auth : Bearer (curl/dev) OU `?t=<signed_token>` scopé sur l'invoiceId
 * (généré via /api/exports/sign, TTL 5 min). Le service client est utilisé
 * pour les SELECT et l'ownership est vérifié manuellement (le signed token
 * ne porte pas de session Supabase).
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
        id, invoice_date, invoice_number, total_ht, variation_pct,
        supplier:suppliers(name),
        restaurant:restaurants(id, name, owner_id)
      `)
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr) throw internal("Erreur lors de la lecture de la facture", invErr);

    const invoice = inv as unknown as {
      id: string;
      invoice_date: string | null;
      invoice_number: string | null;
      total_ht: number | null;
      variation_pct: number | null;
      supplier: { name: string } | null;
      restaurant: { id: string; name: string; owner_id: string } | null;
    } | null;

    // Ownership manuel : signed token ne porte pas de session Supabase, donc
    // RLS n'est pas applicable ici. On retourne 404 plutôt que 403 pour ne pas
    // révéler l'existence d'une facture appartenant à un autre user.
    if (!invoice || !invoice.restaurant || invoice.restaurant.owner_id !== userId) {
      throw notFound("Facture introuvable");
    }

    const { data: rawItems, error: itemsErr } = await sb
      .from("invoice_items")
      .select(`
        id, product_id, raw_label, quantity, unit, unit_price_ht, total_price_ht,
        vat_rate, corrected_at
      `)
      .eq("invoice_id", invoiceId);
    if (itemsErr) throw internal("Erreur lors de la lecture des lignes", itemsErr);

    type RawItem = {
      id: string;
      product_id: string | null;
      raw_label: string;
      quantity: number;
      unit: string | null;
      unit_price_ht: number | null;
      total_price_ht: number | null;
      vat_rate: number | null;
      corrected_at: string | null;
    };
    const items = (rawItems ?? []) as RawItem[];

    // Prix précédents (même logique que la page détail).
    const productIds = items.map((i) => i.product_id).filter(Boolean) as string[];
    const prevByProduct = new Map<string, number>();
    if (productIds.length > 0) {
      const { data: prevPrices } = await sb
        .from("price_history")
        .select("product_id, price_ht, recorded_at, invoice_id")
        .in("product_id", productIds)
        .order("recorded_at", { ascending: false });
      const rows = (prevPrices ?? []) as {
        product_id: string;
        price_ht: number;
        invoice_id: string | null;
      }[];
      for (const p of rows) {
        if (p.invoice_id === invoiceId) continue;
        if (!prevByProduct.has(p.product_id)) {
          prevByProduct.set(p.product_id, Number(p.price_ht));
        }
      }
    }

    const data: InvoicePdfData = {
      supplierName: invoice.supplier?.name ?? "Fournisseur inconnu",
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      totalHt: invoice.total_ht != null ? Number(invoice.total_ht) : null,
      variationPct: invoice.variation_pct != null ? Number(invoice.variation_pct) : null,
      generatedAt: new Date().toISOString(),
      restaurantName: invoice.restaurant.name ?? null,
      items: items.map((it) => ({
        label: it.raw_label,
        quantity: Number(it.quantity ?? 0),
        unit: it.unit,
        // null préservé jusqu'au composant PDF — InvoicePdf gère l'affichage
        // "0,00 EUR*" + footnote, jamais NaN.
        unitPriceHt: it.unit_price_ht == null ? null : Number(it.unit_price_ht),
        totalPriceHt: it.total_price_ht == null ? null : Number(it.total_price_ht),
        vatRate: it.vat_rate != null ? Number(it.vat_rate) : null,
        previousPrice: it.product_id ? prevByProduct.get(it.product_id) ?? null : null,
        corrected: Boolean(it.corrected_at),
      })),
    };

    const buffer = await renderToBuffer(
      createElement(InvoicePdf, { data }) as unknown as Parameters<typeof renderToBuffer>[0],
    );

    const supplierSlug = (data.supplierName || "facture")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30);
    const dateSlug = (data.invoiceDate ?? new Date().toISOString()).slice(0, 10);
    const filename = `yield-${supplierSlug}-${dateSlug}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiErrorResponse(err, "invoices/export-pdf");
  }
}
