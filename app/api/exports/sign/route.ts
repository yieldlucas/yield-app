import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signExportToken } from "@/lib/export-token";
import { apiErrorResponse, badRequest, unauthorized } from "@/lib/api-error";

export const runtime = "nodejs";

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/**
 * Émet un token signé court-terme (5 min) pour un download d'export.
 * Le client construit ensuite l'URL `/api/...?t=<token>` et ouvre la fenêtre.
 *
 * Pattern :
 *   POST /api/exports/sign  body: { sub: invoiceId | null }
 *     -> 200 { token, expiresIn: 300 }
 *
 * sub :
 *   - invoiceId pour /api/invoices/[id]/export-pdf|csv
 *   - null pour /api/exports/csv (global)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) throw unauthorized();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
    );

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) throw unauthorized("Session expirée");

    const body = (await req.json().catch(() => ({}))) as { sub?: unknown };
    const rawSub = body.sub;
    let sub: string | null;
    if (rawSub === null || rawSub === undefined) {
      sub = null;
    } else if (typeof rawSub === "string" && UUID_RE.test(rawSub)) {
      sub = rawSub;
    } else {
      throw badRequest("sub doit être un UUID ou null");
    }

    const token = signExportToken(user.id, sub);
    return NextResponse.json({ token, expiresIn: 300 });
  } catch (err) {
    return apiErrorResponse(err, "exports/sign");
  }
}
