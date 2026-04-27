import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
// Vercel max duration : Pro = 60s, Hobby = 10s. Le scan IA peut prendre 15-25s
// par BL, donc on autorise jusqu'à 60s pour rester safe sur Pro.
export const maxDuration = 60;

// Pipeline :
// 1. Auth via Bearer token (cohérent avec le reste de l'API, client en localStorage)
// 2. Récupère le restaurant lié au user
// 3. Upload du fichier dans Storage
// 4. Insert facture (status: pending)
// 5. Délègue à la Supabase Edge Function (Claude Vision + comparaison prix)

export async function POST(request: NextRequest) {
  // ─── Auth Bearer (compatible avec le client localStorage) ───
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  // ─── Restaurant ───
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: "Aucun restaurant trouvé" }, { status: 404 });
  }

  // ─── Validation fichier ───
  const formData = await request.formData();
  const file = formData.get("invoice") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Format non supporté. Utilisez JPEG, PNG, WebP ou PDF." },
      { status: 400 }
    );
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (max 20 Mo)." },
      { status: 400 }
    );
  }

  // ─── Upload Storage ───
  const safeFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storagePath = `${restaurant.id}/${Date.now()}-${safeFilename}`;

  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json(
      { error: "Erreur lors de l'upload de l'image" },
      { status: 500 }
    );
  }

  // ─── Insert facture (status: pending) ───
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      restaurant_id: restaurant.id,
      image_path: storagePath,
      status: "pending",
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Erreur création facture" }, { status: 500 });
  }

  // ─── Délègue à la Supabase Edge Function ───
  const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-invoice`;

  const edgeResponse = await fetch(edgeFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ invoice_id: invoice.id }),
  });

  if (!edgeResponse.ok) {
    const errorBody = await edgeResponse.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Échec traitement IA", invoice_id: invoice.id, details: errorBody },
      { status: edgeResponse.status }
    );
  }

  const result = await edgeResponse.json();
  return NextResponse.json(result, { status: 200 });
}
