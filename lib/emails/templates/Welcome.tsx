// Welcome email — déclenché à la première connexion du chef.
// Pitch rapide + CTA vers le 1er scan.
//
// Utilise @react-email/components : styles inline (compatibilité Gmail/Outlook),
// pas de <style> tag, pas de classes CSS.

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

export type WelcomeEmailProps = {
  /** Affiché dans la salutation. Défaut "chef" si on ne connaît pas le prénom. */
  firstName: string;
  /** URL absolue du dashboard (incluant scheme + host). */
  dashboardUrl: string;
};

export default function WelcomeEmail({ firstName, dashboardUrl }: WelcomeEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Bienvenue sur Yield, {firstName}. Scannez votre premier BL en 2 minutes.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brand}>
            <Text style={brandTitle}>YIELD</Text>
            <Text style={brandSub}>Pilotage marges restauration</Text>
          </Section>

          <Heading as="h1" style={h1}>Salut Chef ! 👨‍🍳</Heading>

          <Text style={text}>
            C&apos;est Lucas de Yield. Ravi de vous accueillir.
          </Text>

          <Text style={text}>
            <strong>Scannez votre premier BL dès maintenant pour protéger vos marges.</strong>
            {" "}En 30 secondes, Yield extrait chaque ligne, suit l&apos;évolution des prix
            et vous alerte dès qu&apos;un fournisseur augmente discrètement.
          </Text>

          <Section style={cta}>
            <Button style={button} href={dashboardUrl}>
              Scanner mon premier BL
            </Button>
          </Section>

          <Section style={tip}>
            <Text style={tipText}>
              <strong style={tipStrong}>Conseil</strong> — prenez en photo votre prochain
              BL dès la réception. C&apos;est le meilleur moyen de bâtir un historique
              fiable qui parle directement à vos fiches techniques.
            </Text>
          </Section>

          <Text style={text}>
            Vous avez 14 jours d&apos;essai gratuit, sans carte bancaire requise. Aucune
            facturation tant que vous n&apos;avez pas explicitement souscrit.
          </Text>

          <Text style={signature}>
            — Lucas, fondateur de Yield
          </Text>

          <Section style={footer}>
            <Text style={footerText}>
              Une question ? Répondez simplement à cet e-mail, on lit chaque réponse
              (sous 2h en jours ouvrés).
            </Text>
            <Text style={legal}>
              Yield · Par des chefs, pour des chefs · {" "}
              <Link href="https://yieldapp.fr/terms" style={legalLink}>CGU</Link>
              {" · "}
              <Link href="https://yieldapp.fr/privacy" style={legalLink}>Confidentialité</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles (inline, Gmail-safe) ──────────────────────────
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
const brand = { textAlign: "center" as const, marginBottom: "32px" };
const brandTitle = {
  fontSize: "26px",
  fontWeight: 900 as const,
  color: "#2563eb",
  letterSpacing: "-0.5px",
  margin: 0,
  lineHeight: 1.1,
};
const brandSub = {
  fontSize: "11px",
  color: "#94a3b8",
  margin: "4px 0 0 0",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
};
const h1 = {
  fontSize: "22px",
  fontWeight: 700 as const,
  color: "#0f172a",
  margin: "0 0 16px 0",
};
const text = {
  fontSize: "15px",
  lineHeight: "1.65",
  color: "#475569",
  margin: "0 0 20px 0",
};
const cta = { textAlign: "center" as const, margin: "28px 0" };
const button = {
  backgroundColor: "#2563eb",
  color: "#ffffff",
  padding: "14px 28px",
  borderRadius: "12px",
  fontSize: "14px",
  fontWeight: 600 as const,
  textDecoration: "none",
  display: "inline-block",
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
const signature = { fontSize: "14px", color: "#64748b", margin: "24px 0 0 0" };
const footer = { marginTop: "32px", borderTop: "1px solid #e2e8f0", paddingTop: "20px" };
const footerText = { fontSize: "13px", color: "#64748b", margin: "0 0 12px 0" };
const legal = { fontSize: "11px", color: "#94a3b8", textAlign: "center" as const, margin: 0 };
const legalLink = { color: "#94a3b8", textDecoration: "underline" };
