// Email mensuel "Votre mois en Yield" — envoyé le 1er du mois suivant.
// Inspiré du format Spotify Wrapped : récap émotionnel chaleureux qui devient
// un rituel attendu. Filtré côté cron pour ne s'envoyer qu'aux chefs actifs
// (>= 5 scans dans le mois écoulé), sinon on envoie un mail vide qui démotive.

import {
  Body, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from "@react-email/components";

export type MonthlyRecapEmailProps = {
  /** Prénom ou nom du restaurant. Fallback "Chef" si pas encore renseigné. */
  firstName: string;
  /** Mois écoulé en français ("avril", "mai", etc.) — généré par le cron. */
  monthName: string;
  /** Nombre de BL traités dans le mois (status='processed'). */
  invoicesCount: number;
  /** Nombre d'alertes prix générées dans le mois. */
  alertsCount: number;
  /** Plus grosse hausse détectée (% absolu). Null si aucune alerte. */
  biggestRiseProduct: string | null;
  biggestRisePct: number | null;
  /** Nombre de recettes existantes à la fin du mois. */
  recipesCount: number;
  /** URL absolue du dashboard pour le CTA. */
  dashboardUrl: string;
};

export default function MonthlyRecapEmail({
  firstName,
  monthName,
  invoicesCount,
  alertsCount,
  biggestRiseProduct,
  biggestRisePct,
  recipesCount,
  dashboardUrl,
}: MonthlyRecapEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>
        {`Votre mois de ${monthName} en Yield : ${invoicesCount} BL, ${alertsCount} alerte${alertsCount > 1 ? "s" : ""}.`}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brand}>
            <Text style={brandTitle}>YIELD</Text>
            <Text style={brandSub}>Votre mois en Yield</Text>
          </Section>

          <Heading as="h1" style={h1}>
            {firstName}, voici votre {monthName}.
          </Heading>

          <Text style={text}>
            Pendant le mois, Yield a surveillé silencieusement vos prix matière.
            Voici ce qu&apos;il s&apos;est passé.
          </Text>

          {/* Grille de stats */}
          <Section style={statGrid}>
            <div style={statBox}>
              <Text style={statValue}>{invoicesCount}</Text>
              <Text style={statLabel}>BON{invoicesCount > 1 ? "S" : ""} DE LIVRAISON SCANNÉ{invoicesCount > 1 ? "S" : ""}</Text>
            </div>
            <div style={statBox}>
              <Text style={statValueAlert}>{alertsCount}</Text>
              <Text style={statLabel}>ALERTE{alertsCount > 1 ? "S" : ""} PRIX DÉTECTÉE{alertsCount > 1 ? "S" : ""}</Text>
            </div>
          </Section>

          {/* Highlight — la plus grosse hausse */}
          {biggestRiseProduct && biggestRisePct != null && biggestRisePct >= 5 && (
            <Section style={highlightBox}>
              <Text style={highlightLabel}>👀 LE PRODUIT À SURVEILLER</Text>
              <Text style={highlightProduct}>{biggestRiseProduct}</Text>
              <Text style={highlightPct}>+{biggestRisePct.toFixed(1)}%</Text>
              <Text style={highlightCaption}>
                C&apos;est la plus grosse variation détectée ce mois-ci. Pensez à en
                discuter avec votre fournisseur — ou ajustez votre carte avant le prochain service.
              </Text>
            </Section>
          )}

          {/* Engagement recettes */}
          {recipesCount > 0 && (
            <Text style={text}>
              <strong>{recipesCount} plat{recipesCount > 1 ? "s" : ""} surveillé{recipesCount > 1 ? "s" : ""}</strong> dans votre
              carte. Chaque scan met à jour leur marge en temps réel.
            </Text>
          )}

          {recipesCount === 0 && invoicesCount >= 5 && (
            <Section style={tip}>
              <Text style={tipText}>
                <strong style={tipStrong}>Conseil</strong> — vous scannez régulièrement,
                mais aucune recette n&apos;est encore suivie. Composez votre 1ère
                fiche technique dans la calculatrice — Yield veillera sur sa marge
                à chaque livraison.
              </Text>
            </Section>
          )}

          {/* CTA */}
          <Section style={cta}>
            <Link href={dashboardUrl} style={primaryButton}>
              Ouvrir mon tableau de bord
            </Link>
          </Section>

          <Text style={signature}>
            À très vite,<br />
            — Lucas, fondateur de Yield
          </Text>

          <Section style={footer}>
            <Text style={footerText}>
              Vous recevez ce récap parce que vous avez utilisé Yield ce mois-ci.
              Pas envie ? Répondez «&nbsp;stop&nbsp;» à cet email.
            </Text>
            <Text style={legal}>
              Yield · {" "}
              <Link href="https://www.yieldapp.fr/terms" style={legalLink}>CGU</Link>
              {" · "}
              <Link href="https://www.yieldapp.fr/privacy" style={legalLink}>Confidentialité</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles inline (Gmail-safe) ──────────────────────────
const body = {
  backgroundColor: "#F7F9FF",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  padding: "40px 16px",
  margin: 0,
};
const container = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "40px 32px",
  maxWidth: "560px",
  margin: "0 auto",
  border: "1px solid #e2e8f0",
};
const brand = { textAlign: "center" as const, marginBottom: "24px" };
const brandTitle = {
  fontSize: "24px",
  fontWeight: 900 as const,
  color: "#2563eb",
  letterSpacing: "-0.5px",
  margin: 0,
};
const brandSub = {
  fontSize: "11px",
  color: "#94a3b8",
  margin: "4px 0 0 0",
  textTransform: "uppercase" as const,
  letterSpacing: "1.5px",
};
const h1 = {
  fontSize: "26px",
  fontWeight: 700 as const,
  color: "#0f172a",
  margin: "0 0 14px 0",
  lineHeight: 1.25,
};
const text = {
  fontSize: "15px",
  lineHeight: "1.65",
  color: "#475569",
  margin: "0 0 20px 0",
};
const statGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
  margin: "20px 0",
};
const statBox = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "18px 16px",
  textAlign: "center" as const,
};
const statValue = {
  fontSize: "36px",
  fontWeight: 800 as const,
  color: "#2563eb",
  lineHeight: 1,
  margin: 0,
};
const statValueAlert = {
  fontSize: "36px",
  fontWeight: 800 as const,
  color: "#dc2626",
  lineHeight: 1,
  margin: 0,
};
const statLabel = {
  fontSize: "10px",
  fontWeight: 600 as const,
  color: "#64748b",
  letterSpacing: "1.2px",
  margin: "6px 0 0 0",
  textTransform: "uppercase" as const,
};
const highlightBox = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "12px",
  padding: "20px",
  textAlign: "center" as const,
  margin: "20px 0 24px 0",
};
const highlightLabel = {
  fontSize: "10px",
  fontWeight: 600 as const,
  color: "#dc2626",
  letterSpacing: "1.5px",
  margin: "0 0 8px 0",
  textTransform: "uppercase" as const,
};
const highlightProduct = {
  fontSize: "18px",
  fontWeight: 700 as const,
  color: "#0f172a",
  margin: "0 0 4px 0",
};
const highlightPct = {
  fontSize: "32px",
  fontWeight: 800 as const,
  color: "#dc2626",
  lineHeight: 1,
  margin: "0 0 8px 0",
};
const highlightCaption = {
  fontSize: "13px",
  lineHeight: 1.5,
  color: "#475569",
  margin: 0,
};
const tip = {
  backgroundColor: "#f8fafc",
  borderLeft: "3px solid #2563eb",
  padding: "16px 20px",
  borderRadius: "6px",
  margin: "0 0 24px 0",
};
const tipText = { fontSize: "13.5px", lineHeight: "1.6", color: "#475569", margin: 0 };
const tipStrong = { color: "#0f172a" };
const cta = { textAlign: "center" as const, margin: "28px 0 16px 0" };
const primaryButton = {
  backgroundColor: "#2563eb",
  color: "#ffffff",
  padding: "14px 28px",
  borderRadius: "12px",
  fontSize: "14px",
  fontWeight: 600 as const,
  textDecoration: "none",
  display: "inline-block",
};
const signature = { fontSize: "14px", color: "#64748b", margin: "24px 0 0 0" };
const footer = { marginTop: "28px", borderTop: "1px solid #e2e8f0", paddingTop: "20px" };
const footerText = { fontSize: "13px", color: "#64748b", margin: "0 0 12px 0" };
const legal = { fontSize: "11px", color: "#94a3b8", textAlign: "center" as const, margin: 0 };
const legalLink = { color: "#94a3b8", textDecoration: "underline" };
