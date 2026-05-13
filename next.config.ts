import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Build strict : toute regression TS ou ESLint qui passerait la review locale
  // fait échouer le déploiement Vercel. Filet de sécurité final avant prod.
  // Pour ne PAS bloquer un hotfix urgent, on peut temporairement repasser à
  // `ignoreBuildErrors: true` puis fixer après.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
