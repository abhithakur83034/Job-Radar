import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from '../src/config/env.js';
import { mailTransport, parseAddress, sendMail } from '../src/services/mail.service.js';

const KEYS = ['MAIL_FROM', 'BREVO_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const saved = Object.fromEntries(KEYS.map((k) => [k, env[k]]));

function setMailEnv(values) {
  for (const k of KEYS) env[k] = values[k];
}

describe('mail service', () => {
  afterEach(() => {
    setMailEnv(saved);
    vi.unstubAllGlobals();
  });

  it('parses sender addresses with and without a display name', () => {
    expect(parseAddress('JobRadar <me@example.com>')).toEqual({ name: 'JobRadar', email: 'me@example.com' });
    expect(parseAddress('"Job Radar" <me@example.com>')).toEqual({ name: 'Job Radar', email: 'me@example.com' });
    expect(parseAddress('me@example.com')).toEqual({ email: 'me@example.com' });
  });

  it('picks Brevo over SMTP, and nothing without MAIL_FROM', () => {
    setMailEnv({ MAIL_FROM: 'a@b.co', BREVO_API_KEY: 'k', SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' });
    expect(mailTransport()).toBe('brevo');
    setMailEnv({ MAIL_FROM: 'a@b.co', SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' });
    expect(mailTransport()).toBe('smtp');
    setMailEnv({ BREVO_API_KEY: 'k' });
    expect(mailTransport()).toBeNull();
  });

  it('sends through the Brevo API and reports failures without throwing', async () => {
    setMailEnv({ MAIL_FROM: 'JobRadar <me@example.com>', BREVO_API_KEY: 'test-key' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messageId: 'x' }) });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await sendMail({ to: 'user@example.com', subject: 'Hi', text: 't', html: '<p>h</p>' });
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('test-key');
    expect(JSON.parse(init.body)).toEqual({
      sender: { name: 'JobRadar', email: 'me@example.com' },
      to: [{ email: 'user@example.com' }],
      subject: 'Hi',
      textContent: 't',
      htmlContent: '<p>h</p>',
    });

    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ code: 'unauthorized', message: 'Key not found' }) });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendMail({ to: 'user@example.com', subject: 'Hi', text: 't', html: 'h' })).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
