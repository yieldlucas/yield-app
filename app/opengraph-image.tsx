import { ImageResponse } from "next/og";

// Convention Next.js App Router : ce fichier génère automatiquement l'image
// OpenGraph (Facebook, LinkedIn, Slack, WhatsApp, Discord, etc.) pour la
// route racine. Format imposé : 1200×630 (2.43:1, lisible petite taille).
//
// Pas d'image statique — l'ImageResponse génère un PNG à la demande, cache
// CDN automatique. Avantage : zéro asset à maintenir, le branding évolue
// avec le code.

export const runtime = "edge";
export const alt = "YIELD — L'IA qui veille sur votre marge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 100px",
          background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 35%, #4F46E5 100%)",
          position: "relative",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Halo décoratif top-right */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
          }}
        />
        {/* Halo décoratif bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -250,
            left: -150,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(96,165,250,0.25) 0%, transparent 70%)",
          }}
        />

        {/* Header — logo + tag */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            👨‍🍳
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                color: "white",
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              YIELD
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              Pour les chefs
            </div>
          </div>
        </div>

        {/* Headline principal */}
        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          <div
            style={{
              color: "white",
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Votre marge fond.
          </div>
          <div
            style={{
              color: "#bfdbfe",
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            En silence.
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 28,
              fontWeight: 500,
              marginTop: 28,
              maxWidth: 800,
              lineHeight: 1.3,
            }}
          >
            L&apos;IA qui lit vos bons de livraison en 30 secondes et vous alerte
            avant que votre food cost ne s&apos;envole.
          </div>
        </div>

        {/* Footer — trust marks */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
            position: "relative",
            color: "rgba(255,255,255,0.85)",
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>✓</span> 14 jours gratuits
          </div>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.4)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>✓</span> Sans carte bancaire
          </div>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.4)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>✓</span> RGPD France
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
