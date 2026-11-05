import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * Outgoing email. Two transports, picked in this order:
 *  1. Brevo HTTPS API (BREVO_API_KEY + MAIL_FROM): works on hosts that block outbound
 *     SMTP ports, such as Render's free tier.
 *  2. SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS + MAIL_FROM): any provider, e.g. Gmail with an app password.
 * With neither configured, mail is disabled.
 */
export function mailTransport() {
  if (!env.MAIL_FROM) return null;
  if (env.BREVO_API_KEY) return 'brevo';
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return 'smtp';
  return null;
}

export function isMailConfigured() {
  return mailTransport() !== null;
}

/** Parses `"Name <addr@x.com>"` or `addr@x.com` into { name, email }. */
export function parseAddress(value) {
  const match = String(value).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim() || undefined, email: match[2].trim() };
  return { email: String(value).trim() };
}

let smtpTransport = null;
function getSmtpTransport() {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // implicit TLS on 465; STARTTLS otherwise
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
    });
  }
  return smtpTransport;
}

async function sendViaBrevo({ to, subject, text, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: parseAddress(env.MAIL_FROM),
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `Brevo responded ${res.status}`);
    err.code = body.code || `HTTP_${res.status}`;
    throw err;
  }
}

/** Sends an email; returns false (without throwing) if mail isn't configured or delivery fails. */
export async function sendMail({ to, subject, text, html }) {
  const transport = mailTransport();
  if (!transport) return false;
  try {
    if (transport === 'brevo') await sendViaBrevo({ to, subject, text, html });
    else await getSmtpTransport().sendMail({ from: env.MAIL_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    // Never log message bodies (they contain reset links)
    console.error(`[Mail] Delivery via ${transport} failed:`, err.code || '', err.message);
    return false;
  }
}
