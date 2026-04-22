import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MargeChef — Protégez votre marge",
    short_name: "MargeChef",
    description:
      "Photographiez vos factures fournisseurs. L'IA analyse les prix et vous alerte en temps réel quand votre marge est menacée.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#060608",
    theme_color: "#F97316",
    orientation: "portrait-primary",
    categories: ["business", "productivity", "food"],
    lang: "fr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Scanner une facture",
        short_name: "Scanner",
        description: "Photographier une facture fournisseur",
        url: "/dashboard?action=scan",
        icons: [{ src: "/icons/shortcut-camera.png", sizes: "96x96" }],
      },
      {
        name: "Mes alertes",
        short_name: "Alertes",
        description: "Voir les alertes de marge",
        url: "/dashboard#alertes",
        icons: [{ src: "/icons/shortcut-bell.png", sizes: "96x96" }],
      },
    ],
    screenshots: [
      {
        src: "/screenshots/dashboard.png",
        sizes: "390x844",
        form_factor: "narrow",
        label: "Tableau de bord MargeChef",
      },
    ],
  };
}
