import { NextRequest, NextResponse } from "next/server";
import { authorizeBearer } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-admin";
import { apiErrorResponse, internal } from "@/lib/api-error";

export const runtime = "nodejs";

/**
 * Suppression de compte (RGPD). L'identité est vérifiée via le Bearer JWT
 * (clé anon), et la suppression elle-même utilise le service-role
 * (auth.admin.deleteUser). La cascade DB (ON DELETE CASCADE) supprime ensuite
 * profiles, restaurants, invoices, etc. Le storage est nettoyé séparément
 * par un trigger ou un cron — voir migration 002.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw internal("Service role non configuré");
    }
    const { userId } = await authorizeBearer(req);

    const adminClient = getServiceClient();
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw internal("Suppression du compte impossible", deleteError);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err, "account/delete");
  }
}
