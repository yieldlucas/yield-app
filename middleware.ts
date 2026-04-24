import { NextResponse, type NextRequest } from "next/server";

// Pour l'instant, aucune logique serveur active (auth gérée côté client via Supabase + localStorage).
// Ce middleware existe pour garantir que :
//   - Stripe peut appeler /api/stripe/webhook sans être intercepté
//   - Les assets statiques et les routes PWA passent sans friction
//   - Toute future logique d'auth SSR héritera automatiquement de l'exclusion du webhook
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /**
     * Match toutes les routes SAUF :
     *  - api/stripe/webhook  → Stripe envoie des requêtes signées sans session
     *  - _next/static        → assets Next.js compilés
     *  - _next/image         → images optimisées
     *  - favicon.ico / icon  → icônes auto-générées
     *  - apple-icon          → icône iOS
     *  - manifest.webmanifest → manifeste PWA
     *  - sw.js               → service worker
     *  - offline             → page hors-ligne (doit rester accessible sans auth)
     */
    "/((?!api/stripe/webhook|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|offline).*)",
  ],
};
