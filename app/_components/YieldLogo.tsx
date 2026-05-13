// Logo Yield — monogramme toque-Y.
//
// Concept : une toque de chef stylisée (3 bumps + corps + bandeau) avec
// un Y "carvé" au centre. Scalable du favicon 16px à l'OG 1200×630.
//
// ── Deux modes d'utilisation ──────────────────────────────────────────
//
//   1. Monochrome (drop-in remplacement de ChefHat lucide-react) :
//      <YieldLogo size={18} className="text-white" />
//      → Le toque ET le Y prennent currentColor → silhouette unie.
//      Adapté aux petits formats (< 24px) où le Y serait illisible
//      de toute façon, et aux contextes UI où on veut la cohérence
//      Tailwind (text-*).
//
//   2. Two-color (logo de marque complet) :
//      <YieldLogo size={48} toqueColor="white" accentColor="#2563EB" />
//      → Toque + Y de couleurs différentes → la marque est lisible.
//      Adapté aux placements "hero" : splash, OG images, PWA icons,
//      footer brand, etc.

type YieldLogoProps = {
  /** Taille du logo en pixels (carré). Défaut 32. */
  size?: number;
  /** Couleur de la toque. Par défaut `currentColor` → hérite de la couleur
   *  du parent via Tailwind (`text-white`, `text-blue-600`, etc.). */
  toqueColor?: string;
  /** Couleur du Y. Par défaut identique à `toqueColor` (silhouette
   *  monochrome). Définir explicitement pour révéler le Y "carvé"
   *  (typiquement la couleur de fond du parent). */
  accentColor?: string;
  /** Classes Tailwind appliquées au `<svg>`. Permet `text-*` pour piloter
   *  `currentColor` quand `toqueColor` est laissé par défaut. */
  className?: string;
};

export function YieldLogo({
  size = 32,
  toqueColor = "currentColor",
  accentColor,
  className,
}: YieldLogoProps) {
  // Si pas d'accent explicite → Y invisible (même couleur que la toque) →
  // silhouette monochrome propre. C'est ce qui rend YieldLogo drop-in
  // pour les anciens usages de ChefHat avec text-*.
  const accent = accentColor ?? toqueColor;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Logo Yield"
    >
      {/* ─── Toque de chef ─────────────────────────────────── */}
      <circle cx="30" cy="34" r="13" fill={toqueColor} />
      <circle cx="50" cy="25" r="15" fill={toqueColor} />
      <circle cx="70" cy="34" r="13" fill={toqueColor} />
      <rect x="22" y="40" width="56" height="32" fill={toqueColor} />
      <rect x="20" y="70" width="60" height="10" rx="3" fill={toqueColor} />

      {/* ─── Y monogramme ────────────────────────────────────
          Stroke épais (9 sur 100) pour rester visible jusqu'à
          ~16-18px. En-dessous, le Y disparait dans la silhouette
          mais le résultat reste un chef-toque reconnaissable. */}
      <path
        d="M 38 46 L 50 60 L 62 46 M 50 60 L 50 73"
        stroke={accent}
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
