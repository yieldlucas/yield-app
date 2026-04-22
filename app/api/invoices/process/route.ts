import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cette route Next.js :
// 1. Upload l'image dans Supabase Storage
// 2. Crée l'entrée en base
// 3. Délègue le traitement lourd à la Supabase Edge Function
// (Claude Vision, comparaison prix, alertes)

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  // Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Restaurant
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: "Aucun restaurant trouvé" }, { status: 404 });
  }

  // Validation du fichier
  const formData = await request.formData();
  const file = formData.get("invoice") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Format non supporté. Utilisez JPEG, PNG ou WebP." },
      { status: 400 }
    );
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (max 20 Mo)." },
      { status: 400 }
    );
  }

  // Upload dans Supabase Storage
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

  // Création de l'entrée facture
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

  // Récupère le token d'accès pour l'appeler en tant qu'utilisateur authentifié
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  // Délègue à la Supabase Edge Function
  const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-invoice`;

  const edgeResponse = await fetch(edgeFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
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
