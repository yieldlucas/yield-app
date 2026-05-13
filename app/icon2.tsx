import { ImageResponse } from "next/og";

// Icon 512×512 — utilisé par le manifest PWA (résolutions élevées Android,
// splash screens, app stores PWA). Aussi utilisé en variante "maskable"
// pour les launchers qui découpent l'icône dans une forme (rond, squircle).
// Le padding interne assure que le logo reste visible même après masking.

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon512() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #2563EB, #4F46E5)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="340"
          height="340"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Toque chef */}
          <circle cx="30" cy="34" r="13" fill="white" />
          <circle cx="50" cy="25" r="15" fill="white" />
          <circle cx="70" cy="34" r="13" fill="white" />
          <rect x="22" y="40" width="56" height="32" fill="white" />
          <rect x="20" y="70" width="60" height="10" rx="3" fill="white" />
          {/* Y monogramme intérieur */}
          <path
            d="M 38 46 L 50 60 L 62 46 M 50 60 L 50 73"
            stroke="#2563EB"
            strokeWidth="9"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
