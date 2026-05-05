// Client Supabase service-role pour les opérations qui doivent bypasser RLS
// (webhooks, jobs background, vérifications cross-user). À NE JAMAIS importer
// depuis du code client — ce module est node-only.
//
// Lazy-init pour éviter de crasher au boot Next.js si la variable d'env n'est
// pas encore chargée (build-time vs runtime).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

/**
 * Retourne le client service-role singleton. Throw si la SERVICE_ROLE_KEY
 * n'est pas définie en env (faute de config = on veut crasher tôt).
 */
export function getServiceClient(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role config manquante (URL ou SERVICE_ROLE_KEY)");
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
