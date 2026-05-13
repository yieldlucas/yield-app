import type { MetadataRoute } from "next";

/**
 * /sitemap.xml — généré par Next.js. Liste les pages publiques indexables
 * pour aider Google à les crawler. Les pages auth (dashboard, billing) sont
 * exclues — elles renvoient un spinner avant redirect si pas de session,
 * aucune valeur SEO.
 *
 * lastModified : pour l'instant date du build. Si on commence à éditer
 * souvent les CGU ou la landing, faut basculer sur des constantes par page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.yieldapp.fr";
  const now = new Date();

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/how-it-works`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
