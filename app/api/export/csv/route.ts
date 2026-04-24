import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type InvoiceRow = {
  invoice_date: string | null;
  supplier: { name: string | null } | null;
  items: Array<{
    raw_label: string | null;
    quantity: number | null;
    unit_price_ht: number | null;
    total_price_ht: number | null;
    vat_rate: number | null;
  }>;
};

// Échappement CSV RFC 4180 : double-quote les valeurs contenant ; " ou \n
function csvEscape(raw: unknown): string {
  const s = raw == null ? "" : String(raw);
  if (/[;"\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: InvoiceRow[]): string {
  const header = ["Date", "Fournisseur", "Produit", "Quantite", "PU HT", "Total HT", "TVA %", "TVA", "TTC"];
  const lines: string[] = [header.join(";")];

  for (const inv of rows) {
    const date = inv.invoice_date ?? "";
    const supplier = inv.supplier?.name ?? "";
    for (const item of inv.items ?? []) {
      const ht = Number(item.total_price_ht ?? 0);
      const vatRate = Number(item.vat_rate ?? 0);
      const vat = ht * (vatRate / 100);
      const ttc = ht + vat;
      lines.push([
        csvEscape(date),
        csvEscape(supplier),
        csvEscape(item.raw_label ?? ""),
        csvEscape((item.quantity ?? 0).toFixed(2).replace(".", ",")),
        csvEscape((item.unit_price_ht ?? 0).toFixed(2).replace(".", ",")),
        csvEscape(ht.toFixed(2).replace(".", ",")),
        csvEscape(vatRate.toFixed(1).replace(".", ",")),
        csvEscape(vat.toFixed(2).replace(".", ",")),
        csvEscape(ttc.toFixed(2).replace(".", ",")),
      ].join(";"));
    }
  }
  return lines.join("\r\n");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const accessToken =
    authHeader?.replace(/^Bearer\s+/i, "").trim() ||
    req.nextUrl.searchParams.get("t");

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("restaurant_id")
    .eq("id", user.id)
    .maybeSingle();

  const restaurantId = (profile as { restaurant_id?: string } | null)?.restaurant_id;
  if (!restaurantId) {
    return NextResponse.json({ error: "No restaurant linked" }, { status: 404 });
  }

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");

  let query = supabase
    .from("invoices")
    .select(`
      invoice_date,
      supplier:suppliers ( name ),
      items:invoice_items (
        raw_label, quantity, unit_price_ht, total_price_ht, vat_rate
      )
    `)
    .eq("restaurant_id", restaurantId)
    .order("invoice_date", { ascending: true });

  if (fromParam) query = query.gte("invoice_date", fromParam);
  if (toParam) query = query.lte("invoice_date", toParam);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = "﻿" + toCsv((data ?? []) as unknown as InvoiceRow[]); // BOM UTF-8 pour Excel FR
  const filename = `yield-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
