import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration, InstallBanner } from "./components/PwaInit";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "YIELD — Rendement Garanti",
  description:
    "Photographiez vos bons de livraison. L'IA analyse les prix matière et vous alerte en temps réel quand votre rendement est menacé.",
  keywords: ["restaurant", "rendement", "marge", "bon de livraison", "fournisseur", "inflation", "food cost"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "YIELD",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "YIELD",
    description: "La seule app qui surveille votre rendement en temps réel.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Empêche le zoom accidentel sur les formulaires mobiles
  userScalable: false,
  viewportFit: "cover", // Safe area pour les iPhones avec encoche
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased text-slate-900" style={{ background: "#F7F9FF" }}>
        {children}
        <InstallBanner />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
