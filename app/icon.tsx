import { ImageResponse } from "next/og";

// Favicon 32×32 — visible dans les onglets navigateur, bookmarks, et la
// majorité des résultats de recherche. À cette taille, la toque détaillée
// devient illisible : on garde juste le Y monogramme sur fond gradient,
// version condensée du logo (cohérence couleurs/typographie avec le logo
// plein affiché dans les formats plus larges).

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #2563EB, #4F46E5)",
          borderRadius: 7,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: -1,
          fontFamily: "system-ui, sans-serif",
          paddingBottom: 2,
        }}
      >
        Y
      </div>
    ),
    { ...size }
  );
}
