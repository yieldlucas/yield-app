// Helper d'envoi d'emails transactionnels via Resend (https://resend.com).
//
// Pré-requis :
//   - RESEND_API_KEY dans Vercel env vars (côté serveur uniquement)
//   - Domaine vérifié sur le dashboard Resend (yieldapp.fr) avec SPF + DKIM
//   - L'adresse FROM doit appartenir au domaine vérifié
//
// Si RESEND_API_KEY n'est pas défini : les sends sont silencieusement
// skippés avec un warning logger (pas d'exception → ne casse pas le flux
// signup / cron). Pratique pour dev local sans Resend configuré.
//
// Pour rendre les templates : on importe les composants react-email et on
// passe par `render()` qui produit du HTML inline-styles compatible Gmail/
// Outlook. Une version texte plain est aussi générée pour les clients qui
// n'affichent pas l'HTML (option `plainText`).

import { render } from "@react-email/components";
import { Resend } from "resend";
import { logger } from "./logger";
import { captureException } from "./error-tracking";
import WelcomeEmail, { type WelcomeEmailProps } from "./emails/templates/Welcome";
import TrialReminderEmail, {
  type TrialReminderEmailProps,
} from "./emails/templates/TrialReminder";
import MonthlyRecapEmail, {
  type MonthlyRecapEmailProps,
} from "./emails/templates/MonthlyRecap";

/** Adresse expéditrice. Doit appartenir au domaine vérifié dans Resend. */
const FROM = "Yield <chef@yield.restaurant>";

/** Adresse de réponse. Quand un chef répond au mail welcome / J-3, ça arrive
 *  ici (boîte Gmail perso de Lucas) plutôt que sur chef@yield.restaurant qui
 *  n'est qu'une adresse d'envoi technique. */
const REPLY_TO = "Lucas (Yield) <lucasyieldapp@gmail.com>";

/**
 * Lazy singleton client Resend. Retourne null si la clé API n'est pas
 * configurée — l'appel est skippé proprement plutôt que de throw.
 */
let _resend: Resend | null | undefined;
function getResendClient(): Resend | null {
  if (_resend !== undefined) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("emails", "RESEND_API_KEY missing — emails won't be sent");
    _resend = null;
    return null;
  }
  _resend = new Resend(apiKey);
  return _resend;
}

/**
 * Envoie un email avec corps HTML + version texte plain. Wrapper unique
 * autour de Resend pour gérer le cas "pas de clé" + capturer les erreurs.
 */
async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Identifiant logique pour les logs / Sentry (ex: "welcome", "trial-reminder"). */
  scope: string;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      replyTo: REPLY_TO,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      captureException(new Error(error.message), `emails/${opts.scope}`, {
        to: opts.to,
        resendError: error,
      });
      return false;
    }
    return true;
  } catch (err) {
    captureException(err, `emails/${opts.scope}`, { to: opts.to });
    return false;
  }
}

/**
 * Bienvenue — déclenché à la 1ère connexion (ou au signup, selon le wiring
 * choisi). Pitch + CTA scan.
 */
export async function sendWelcomeEmail(
  to: string,
  props: WelcomeEmailProps,
): Promise<boolean> {
  const element = <WelcomeEmail {...props} />;
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return sendEmail({
    to,
    subject: `Bienvenue sur Yield, ${props.firstName} 👨‍🍳`,
    html,
    text,
    scope: "welcome",
  });
}

/**
 * Rappel J-3 de fin du trial. À déclencher quotidiennement par cron sur les
 * profils créés il y a ~11 jours et non encore subscribed (trial = 14 jours).
 */
export async function sendTrialReminderEmail(
  to: string,
  props: TrialReminderEmailProps,
): Promise<boolean> {
  const element = <TrialReminderEmail {...props} />;
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = props.alertsCount > 0
    ? `${props.alertsCount} alerte${props.alertsCount > 1 ? "s" : ""} de prix vous attendent — ${props.daysLeft} jour${props.daysLeft > 1 ? "s" : ""} d'essai restants`
    : `Plus que ${props.daysLeft} jour${props.daysLeft > 1 ? "s" : ""} pour scanner gratuitement`;
  return sendEmail({
    to,
    subject,
    html,
    text,
    scope: "trial-reminder",
  });
}

/**
 * Récap mensuel "Votre mois en Yield". Déclenché par cron le 1er de chaque
 * mois sur les chefs ayant scanné >= 5 BL le mois précédent (sinon on
 * envoie un mail vide qui démotive).
 */
export async function sendMonthlyRecapEmail(
  to: string,
  props: MonthlyRecapEmailProps,
): Promise<boolean> {
  const element = <MonthlyRecapEmail {...props} />;
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return sendEmail({
    to,
    subject: `Votre mois de ${props.monthName} en Yield — ${props.invoicesCount} BL surveillés`,
    html,
    text,
    scope: "monthly-recap",
  });
}
