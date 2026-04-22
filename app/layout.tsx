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
  title: "MargeChef — Protégez votre marge, automatiquement",
  description:
    "Photographiez vos factures fournisseurs. L'IA analyse les prix, compare l'historique et vous alerte en temps réel quand votre marge est menacée.",
  keywords: ["restaurant", "marge", "facture", "fournisseur", "inflation", "gestion"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MargeChef",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "MargeChef",
    description: "La seule app qui surveille votre marge en temps réel.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F97316",
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
        {/* Apple PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* Splash screens iOS (facultatif, générer avec un outil dédié) */}
      </head>
      <body className="bg-surface text-slate-100 antialiased">
        {children}
        <InstallBanner />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
