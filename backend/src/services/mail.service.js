import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * Outgoing email over SMTP (any provider: a Gmail account with an app password,
 * Brevo, Mailgun, …). Disabled unless SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM are set.
 */
export function isMailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM);
}

let transport = null;
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // implicit TLS on 465; STARTTLS otherwise
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transport;
}

/** Sends an email; returns false (without throwing) if mail isn't configured or delivery fails. */
export async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) return false;
  try {
    await getTransport().sendMail({ from: env.MAIL_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    // Never log message bodies (they contain reset links)
    console.error('[Mail] Delivery failed:', err.code || err.message);
    return false;
  }
}
