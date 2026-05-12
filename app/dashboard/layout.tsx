"use client";

// Layout commun au dashboard : injecte une transition fade-in subtile à
// chaque navigation interne pour éviter le "snap" brusque entre pages.
// Le wrapper est re-monté à chaque changement de segment grâce à la `key`
// dérivée de useSelectedLayoutSegments — chaque page entre en douceur.
//
// Pas d'exit transition : Next.js App Router ne garde pas l'ancien
// composant en arbre pendant la navigation, donc seul le fade-in fonctionne.
// C'est suffisant pour donner une sensation de fluidité sans complexité
// supplémentaire (le user perçoit l'entrée, pas la sortie).

import { motion } from "framer-motion";
import { useSelectedLayoutSegments } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const segments = useSelectedLayoutSegments();
  // Key stable par route : "/" (home), "invoices/abc", "recipes/xyz", etc.
  // Quand elle change, framer-motion remonte le wrapper et rejoue l'anim.
  const routeKey = segments.join("/") || "root";

  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
