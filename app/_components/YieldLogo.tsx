// Logo Yield — monogramme toque-Y.
//
// Concept : une toque de chef stylisée (3 bumps + corps + bandeau) avec
// un Y "carvé" en couleur d'accent au centre. Lisible jusqu'au favicon
// 16px. Utilisable dans l'UI (header, footer, splash, splash auth, etc.)
// comme alternative à ChefHat (lucide-react) quand on veut affirmer
// l'identité de marque plutôt qu'un pictogramme générique.
//
// Couleurs : par défaut toque blanche + Y bleu Yield (#2563EB), à inverser
// via props (`bg`, `accent`) selon le contexte (fond clair vs fond sombre).

type YieldLogoProps = {
  /** Taille du logo en pixels (carré). */
  size?: number;
  /** Couleur de la toque. Par défaut white pour usage sur gradient sombre. */
  toqueColor?: string;
  /** Couleur du Y intérieur (lit la couleur de fond visuellement). */
  accentColor?: string;
  /** Classe Tailwind additionnelle (ex: drop-shadow, opacity). */
  className?: string;
};

export function YieldLogo({
  size = 32,
  toqueColor = "white",
  accentColor = "#2563EB",
  className,
}: YieldLogoProps) {
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
      {/* 3 bumps du sommet — la signature "puff" de la toque */}
      <circle cx="30" cy="34" r="13" fill={toqueColor} />
      <circle cx="50" cy="25" r="15" fill={toqueColor} />
      <circle cx="70" cy="34" r="13" fill={toqueColor} />
      {/* Corps central qui lie les bumps au bandeau */}
      <rect x="22" y="40" width="56" height="32" fill={toqueColor} />
      {/* Bandeau du bas — partie qui ceint le front du chef */}
      <rect x="20" y="70" width="60" height="10" rx="3" fill={toqueColor} />

      {/* ─── Y monogramme — "carvé" dans la toque ──────────── */}
      <path
        d="M 38 46 L 50 60 L 62 46 M 50 60 L 50 73"
        stroke={accentColor}
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
