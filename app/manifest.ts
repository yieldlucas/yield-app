import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YIELD — Rendement Garanti",
    short_name: "YIELD",
    description:
      "Photographiez vos bons de livraison. L'IA analyse les prix matière et vous alerte en temps réel quand votre rendement est menacé.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F7F9FF",
    theme_color: "#2563EB",
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
        name: "Scanner un bon de livraison",
        short_name: "Scanner",
        description: "Photographier un bon de livraison fournisseur",
        url: "/dashboard?action=scan",
        icons: [{ src: "/icons/shortcut-camera.png", sizes: "96x96" }],
      },
      {
        name: "Alertes Rendement",
        short_name: "Alertes",
        description: "Voir les alertes de coût matière",
        url: "/dashboard#alertes",
        icons: [{ src: "/icons/shortcut-bell.png", sizes: "96x96" }],
      },
    ],
    screenshots: [
      {
        src: "/screenshots/dashboard.png",
        sizes: "390x844",
        form_factor: "narrow",
        label: "Tableau de bord YIELD",
      },
    ],
  };
}
