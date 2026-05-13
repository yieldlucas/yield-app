import { ImageResponse } from "next/og";

// Apple Touch Icon 180×180 — iOS home screen quand l'user ajoute le site
// à l'écran d'accueil Safari. iOS arrondit automatiquement les coins
// (squircle), donc pas besoin de borderRadius explicite ; on garde un
// fond gradient plein qui sera masqué proprement.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          width="120"
          height="120"
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
