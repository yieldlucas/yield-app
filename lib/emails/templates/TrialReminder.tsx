// Trial reminder — envoyé à J-3 de la fin du trial (j+11 du signup).
// Objectif conversion : montrer la valeur déjà créée (alertes détectées) + CTA.

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type TrialReminderEmailProps = {
  firstName: string;
  /** Nombre d'alertes de prix générées pendant le trial. Si 0 : on adapte
   *  le message pour encourager à scanner avant la fin. */
  alertsCount: number;
  /** Nombre de scans déjà réalisés pendant le trial — sert de preuve sociale interne. */
  scansCount: number;
  /** Jours restants avant la fin du trial (typiquement 3). */
  daysLeft: number;
  dashboardUrl: string;
  checkoutUrl: string;
};

export default function TrialReminderEmail({
  firstName,
  alertsCount,
  scansCount,
  daysLeft,
  dashboardUrl,
  checkoutUrl,
}: TrialReminderEmailProps) {
  const hasValue = alertsCount > 0;

  return (
    <Html lang="fr">
      <Head />
      <Preview>
        {hasValue
          ? `Plus que ${daysLeft} jours d'essai — ${alertsCount} alerte${alertsCount > 1 ? "s" : ""} de prix détectée${alertsCount > 1 ? "s" : ""}.`
          : `Plus que ${daysLeft} jours d'essai — il est temps de scanner votre 1er BL.`}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brand}>
            <Text style={brandTitle}>YIELD</Text>
          </Section>

          <Heading as="h1" style={h1}>
            Chef, votre essai se termine dans {daysLeft} jour{daysLeft > 1 ? "s" : ""}
          </Heading>

          <Text style={text}>
            <strong>Ne laissez plus passer d&apos;augmentations de prix cachées.</strong>
            {" "}Une hausse de 8% sur la côte de bœuf qui vous échappe, c&apos;est 1 à 2 points
            de marge perdus à chaque service.
          </Text>

          {hasValue ? (
            <>
              <Text style={text}>
                Pendant votre essai, Yield a analysé <strong>{scansCount} bon{scansCount > 1 ? "s" : ""} de
                livraison</strong> et détecté <strong>{alertsCount} hausse{alertsCount > 1 ? "s" : ""}
                de prix</strong> chez vos fournisseurs.
              </Text>
              <Section style={statBox}>
                <Text style={statLabel}>ALERTES DÉTECTÉES PENDANT VOTRE ESSAI</Text>
                <Text style={statValue}>{alertsCount}</Text>
              </Section>
            </>
          ) : (
            <Text style={text}>
              Vous n&apos;avez pas encore scanné de bon de livraison — il vous reste
              {" "}{daysLeft} jour{daysLeft > 1 ? "s" : ""} pour tester Yield gratuitement.
              Photographiez votre prochain BL à réception, l&apos;analyse prend 30 secondes.
            </Text>
          )}

          <Section style={cta}>
            <Button style={primaryButton} href={checkoutUrl}>
              Passer au plan payant
            </Button>
          </Section>

          <Text style={secondaryCta}>
            <Link href={dashboardUrl} style={inlineLink}>
              {hasValue ? "Voir mes alertes" : "Scanner un BL d'abord"}
            </Link>
          </Text>

          <Text style={text}>
            Sans engagement, résiliable en 1 clic depuis le portail Stripe. À 19,99 € HT/mois,
            la formule Lancement inclut 200 scans, alertes temps réel et exports comptables.
          </Text>

          <Text style={signature}>— Lucas, fondateur de Yield</Text>

          <Section style={footer}>
            <Text style={footerText}>
              Une question ? Répondez simplement à cet e-mail.
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

// ─── Styles ──────────────────────────────────────────────
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
const brand = { textAlign: "center" as const, marginBottom: "28px" };
const brandTitle = {
  fontSize: "24px",
  fontWeight: 900 as const,
  color: "#2563eb",
  letterSpacing: "-0.5px",
  margin: 0,
};
const h1 = {
  fontSize: "21px",
  fontWeight: 700 as const,
  color: "#0f172a",
  margin: "0 0 18px 0",
  lineHeight: 1.3,
};
const text = {
  fontSize: "15px",
  lineHeight: "1.65",
  color: "#475569",
  margin: "0 0 16px 0",
};
const statBox = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "12px",
  padding: "20px",
  textAlign: "center" as const,
  margin: "20px 0 24px 0",
};
const statLabel = {
  fontSize: "10px",
  fontWeight: 600 as const,
  color: "#dc2626",
  letterSpacing: "1.5px",
  margin: "0 0 4px 0",
  textTransform: "uppercase" as const,
};
const statValue = {
  fontSize: "44px",
  fontWeight: 800 as const,
  color: "#dc2626",
  lineHeight: 1,
  margin: 0,
};
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
const secondaryCta = {
  fontSize: "13px",
  color: "#64748b",
  textAlign: "center" as const,
  margin: "0 0 24px 0",
};
const inlineLink = { color: "#2563eb", textDecoration: "underline" };
const signature = { fontSize: "14px", color: "#64748b", margin: "24px 0 0 0" };
const footer = { marginTop: "28px", borderTop: "1px solid #e2e8f0", paddingTop: "20px" };
const footerText = { fontSize: "13px", color: "#64748b", margin: "0 0 12px 0" };
const legal = { fontSize: "11px", color: "#94a3b8", textAlign: "center" as const, margin: 0 };
const legalLink = { color: "#94a3b8", textDecoration: "underline" };
