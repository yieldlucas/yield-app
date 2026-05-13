import type { MetadataRoute } from "next";

/**
 * /robots.txt — généré par Next.js à partir de cette fonction.
 *
 * Politique :
 *   - Landing page (/) + /how-it-works + /terms + /privacy → indexable
 *   - /dashboard, /billing, /api/*, /offline → bloqués (no value SEO, et le
 *     dashboard nécessite une session de toute façon)
 *
 * Le sitemap pointe vers /sitemap.xml généré par app/sitemap.ts.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.yieldapp.fr";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/dashboard/", "/billing", "/api/", "/offline"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
