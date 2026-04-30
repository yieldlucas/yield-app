import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { createClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf, type InvoicePdfData } from "@/lib/pdf/InvoicePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await params;

  // Token via header OU query param (nécessaire pour les downloads navigateur
  // qui ne préservent pas les headers custom).
  const authHeader = req.headers.get("authorization");
  const accessToken =
    authHeader?.replace(/^Bearer\s+/i, "").trim() ||
    req.nextUrl.searchParams.get("t");
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // RLS owner_invoices garantit qu'on ne peut récupérer que ses propres factures.
  const { data: inv, error: invErr } = await supabase
    .from("invoices")
    .select(`
      id, invoice_date, invoice_number, total_ht, variation_pct,
      supplier:suppliers(name),
      restaurant:restaurants(name)
    `)
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr || !inv) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }
  const invoice = inv as unknown as {
    id: string; invoice_date: string | null; invoice_number: string | null;
    total_ht: number | null; variation_pct: number | null;
    supplier: { name: string } | null;
    restaurant: { name: string } | null;
  };

  const { data: rawItems, error: itemsErr } = await supabase
    .from("invoice_items")
    .select(`
      id, product_id, raw_label, quantity, unit, unit_price_ht, total_price_ht,
      vat_rate, corrected_at
    `)
    .eq("invoice_id", invoiceId);
  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }
  type RawItem = {
    id: string; product_id: string | null; raw_label: string;
    quantity: number; unit: string | null; unit_price_ht: number;
    total_price_ht: number; vat_rate: number | null; corrected_at: string | null;
  };
  const items = (rawItems ?? []) as RawItem[];

  // Prix précédents (même logique que la page détail)
  const productIds = items.map(i => i.product_id).filter(Boolean) as string[];
  const prevByProduct = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: prevPrices } = await supabase
      .from("price_history")
      .select("product_id, price_ht, recorded_at, invoice_id")
      .in("product_id", productIds)
      .order("recorded_at", { ascending: false });
    for (const p of (prevPrices ?? []) as { product_id: string; price_ht: number; invoice_id: string | null }[]) {
      if (p.invoice_id === invoiceId) continue;
      if (!prevByProduct.has(p.product_id)) prevByProduct.set(p.product_id, Number(p.price_ht));
    }
  }

  const data: InvoicePdfData = {
    supplierName: invoice.supplier?.name ?? "Fournisseur inconnu",
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    totalHt: invoice.total_ht != null ? Number(invoice.total_ht) : null,
    variationPct: invoice.variation_pct != null ? Number(invoice.variation_pct) : null,
    generatedAt: new Date().toISOString(),
    restaurantName: invoice.restaurant?.name ?? null,
    items: items.map(it => ({
      label: it.raw_label,
      quantity: Number(it.quantity),
      unit: it.unit,
      unitPriceHt: Number(it.unit_price_ht),
      totalPriceHt: Number(it.total_price_ht),
      vatRate: it.vat_rate != null ? Number(it.vat_rate) : null,
      previousPrice: it.product_id ? prevByProduct.get(it.product_id) ?? null : null,
      corrected: Boolean(it.corrected_at),
    })),
  };

  // createElement plutôt que JSX — ce fichier est .ts (pas .tsx) car les
  // route handlers ne contiennent normalement pas de JSX. La génération PDF
  // est faite en runtime Node, pas un rendu React-DOM.
  const buffer = await renderToBuffer(
    createElement(InvoicePdf, { data }) as unknown as Parameters<typeof renderToBuffer>[0],
  );

  const supplierSlug = (data.supplierName || "facture").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  const dateSlug = (data.invoiceDate ?? new Date().toISOString()).slice(0, 10);
  const filename = `yield-${supplierSlug}-${dateSlug}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
