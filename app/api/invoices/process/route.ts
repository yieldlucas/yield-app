import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
// Vercel max duration : Pro = 60s, Hobby = 10s. Le scan IA peut prendre 15-25s
// par BL, donc on autorise jusqu'à 60s pour rester safe sur Pro.
export const maxDuration = 60;

// Quota mensuel inclus dans l'offre lancement (19.99€). Au-delà : prompt
// d'upgrade vers Pro 39.99€ (quota plus élevé). Voir migration 005.
const MONTHLY_SCAN_QUOTA = 200;

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

  // ─── Gate abonnement : essai gratuit 14 jours OU is_subscribed = true ───
  // Source de vérité = profiles.is_subscribed (mis à jour par webhook Stripe)
  // + profiles.created_at pour l'ancienneté de l'inscription
  const TRIAL_DAYS = 14;
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("is_subscribed, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileRow as { is_subscribed?: boolean; created_at?: string } | null;
  const isSubscribed = Boolean(profile?.is_subscribed);
  const createdAt = profile?.created_at ? new Date(profile.created_at) : null;
  const trialMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  let trialActive = createdAt ? Date.now() - createdAt.getTime() < trialMs : false;

  // Anti-fraude : un user qui se ré-inscrit avec un alias email (foo+1@gmail)
  // ou en variant la casse n'a pas droit à un nouveau trial. On compare par
  // normalized_email (calculé par trigger en DB, voir migration 004).
  if (trialActive && createdAt && user.email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const normalized = user.email
      .toLowerCase()
      .replace(/\+[^@]*@/, "@");
    const { data: olderTwin } = await adminClient
      .from("profiles")
      .select("id")
      .eq("normalized_email", normalized)
      .neq("id", user.id)
      .lt("created_at", createdAt.toISOString())
      .limit(1)
      .maybeSingle();
    if (olderTwin) {
      trialActive = false;
    }
  }

  if (!isSubscribed && !trialActive) {
    return NextResponse.json(
      {
        error: "Votre essai gratuit de 14 jours est terminé. Abonnez-vous pour continuer à scanner.",
        code: "SUBSCRIPTION_REQUIRED",
      },
      { status: 402 }
    );
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

  // ─── Quota mensuel ───
  // On bloque AVANT l'upload + IA pour ne pas brûler du token Claude inutilement.
  // Le compteur est incrémenté côté edge function uniquement sur scan réussi.
  const yearMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM' UTC
  const { data: usage } = await supabase
    .from("usage_stats")
    .select("scan_count")
    .eq("restaurant_id", restaurant.id)
    .eq("year_month", yearMonth)
    .maybeSingle();

  const scansUsed = (usage as { scan_count?: number } | null)?.scan_count ?? 0;
  if (scansUsed >= MONTHLY_SCAN_QUOTA) {
    return NextResponse.json(
      {
        error: `Vous avez utilisé l'intégralité de votre forfait mensuel (${MONTHLY_SCAN_QUOTA} scans). Pour continuer à scanner ce mois-ci et débloquer les fonctions Business Intelligence, passez au forfait Pro à 39,99€/mois.`,
        code: "QUOTA_EXCEEDED",
        quota: MONTHLY_SCAN_QUOTA,
        used: scansUsed,
      },
      { status: 402 }
    );
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
