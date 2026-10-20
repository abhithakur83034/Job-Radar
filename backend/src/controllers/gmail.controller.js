import crypto from 'crypto';
import { env } from '../config/env.js';
import { GmailConnection } from '../models/GmailConnection.js';
import { encryptToken, decryptToken } from '../utils/tokenCrypto.js';
import { parseJobAlertEmail } from '../utils/jobAlertParser.js';
import { ingestListings } from '../utils/ingest.js';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const SCOPES = ['openid', 'email', GMAIL_SCOPE];
const STATE_COOKIE = 'jr_gmail_oauth';
const COOKIE_PATH = '/api/v1/gmail';

// Only job-alert senders are searched; nothing else in the mailbox is read.
export const ALERT_SENDERS = [
  'jobalerts-noreply@linkedin.com',
  'jobs-noreply@linkedin.com',
  'naukri.com',
  'jobalert.indeed.com',
  'indeed.com',
];
const MAX_MESSAGES_PER_SYNC = 50;

export function isGmailConfigured() {
  return Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI && env.GMAIL_TOKEN_KEY
  );
}

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function cookieOptions() {
  const secure = env.COOKIE_SECURE === 'true' || env.NODE_ENV === 'production';
  // lax so the cookie survives the top-level redirect back from Google
  return { httpOnly: true, secure, sameSite: 'lax', path: COOKIE_PATH, maxAge: 10 * 60 * 1000 };
}

async function googleFetch(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error_description || body.error?.message || body.error || `Google HTTP ${res.status}`);
    err.googleError = typeof body.error === 'string' ? body.error : body.error?.status;
    throw err;
  }
  return body;
}

function tokenRequest(params) {
  return googleFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      ...params,
    }),
  });
}

async function revokeToken(token) {
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

export async function getGmailStatus(req, res) {
  const connection = await GmailConnection.findOne({ userId: req.user._id });
  return res.json({
    configured: isGmailConfigured(),
    connected: Boolean(connection),
    email: connection?.email ?? null,
    lastSyncAt: connection?.lastSyncAt ?? null,
    senders: ALERT_SENDERS,
  });
}

/** Starts the OAuth flow: GET /api/v1/gmail/connect (full-page navigation). */
export async function connectGmail(req, res) {
  if (!isGmailConfigured()) {
    return res.status(503).json({ error: 'Gmail import is not configured on this server.' });
  }

  const state = base64url(crypto.randomBytes(32));
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());

  // Bind the flow to this browser and this signed-in user
  res.cookie(STATE_COOKIE, `${state}.${verifier}.${req.user._id}`, cookieOptions());

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/** Google redirects here: GET /api/v1/gmail/callback?code=…&state=… */
export async function gmailCallback(req, res) {
  const cookie = req.cookies?.[STATE_COOKIE] || '';
  res.clearCookie(STATE_COOKIE, { ...cookieOptions(), maxAge: undefined });

  if (req.query.error) {
    return res.redirect('/profile?gmail=denied');
  }

  const [expectedState, verifier, userId] = cookie.split('.');
  const state = String(req.query.state || '');
  const stateMatches =
    expectedState &&
    state.length === expectedState.length &&
    crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));
  if (!stateMatches || userId !== String(req.user._id) || !req.query.code) {
    return res.redirect('/profile?gmail=invalid_state');
  }

  let tokens;
  try {
    tokens = await tokenRequest({
      grant_type: 'authorization_code',
      code: String(req.query.code),
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      code_verifier: verifier,
    });
  } catch {
    return res.redirect('/profile?gmail=error');
  }

  // Google lets users untick individual permissions on the consent screen
  const granted = String(tokens.scope || '').split(' ');
  if (!granted.includes(GMAIL_SCOPE) || !tokens.refresh_token) {
    await revokeToken(tokens.refresh_token || tokens.access_token);
    return res.redirect('/profile?gmail=missing_scope');
  }

  // id_token came straight from Google's token endpoint over TLS, so its claims can be read directly
  let email = 'Gmail account';
  try {
    const claims = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString('utf8'));
    if (claims.email) email = claims.email;
  } catch {
    // keep the placeholder
  }

  await GmailConnection.findOneAndUpdate(
    { userId: req.user._id },
    {
      userId: req.user._id,
      email,
      encryptedRefreshToken: encryptToken(tokens.refresh_token, env.GMAIL_TOKEN_KEY),
      lastSyncAt: null,
    },
    { upsert: true }
  );

  return res.redirect('/profile?gmail=connected');
}

function findBody(part, mimeType) {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf8');
  }
  for (const child of part.parts || []) {
    const found = findBody(child, mimeType);
    if (found) return found;
  }
  return null;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** POST /api/v1/gmail/sync: import jobs from recent alert emails. */
export async function syncGmail(req, res) {
  if (!isGmailConfigured()) {
    return res.status(503).json({ error: 'Gmail import is not configured on this server.' });
  }
  const connection = await GmailConnection.findOne({ userId: req.user._id }).select('+encryptedRefreshToken');
  if (!connection) {
    return res.status(404).json({ error: 'Gmail is not connected.' });
  }

  let accessToken;
  try {
    const refreshToken = decryptToken(connection.encryptedRefreshToken, env.GMAIL_TOKEN_KEY);
    accessToken = (await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })).access_token;
  } catch (err) {
    if (err.googleError === 'invalid_grant') {
      // Revoked by the user, or expired (Google expires Testing-mode tokens after 7 days)
      await connection.deleteOne();
      return res.status(409).json({ error: 'Gmail access expired or was revoked. Please reconnect.', reconnect: true });
    }
    throw err;
  }

  const since = connection.lastSyncAt
    ? `after:${Math.floor(connection.lastSyncAt.getTime() / 1000) - 24 * 60 * 60}`
    : 'newer_than:14d';
  const query = `from:(${ALERT_SENDERS.join(' OR ')}) ${since}`;
  const auth = { headers: { Authorization: `Bearer ${accessToken}` } };

  const list = await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({
      q: query,
      maxResults: String(MAX_MESSAGES_PER_SYNC),
    })}`,
    auth
  );
  const messageIds = (list.messages || []).map((m) => m.id);

  const perMessage = await mapWithConcurrency(messageIds, 5, async (id) => {
    const message = await googleFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      auth
    );
    const html = findBody(message.payload, 'text/html');
    const text = html ? null : findBody(message.payload, 'text/plain');
    return parseJobAlertEmail(html || (text ? text.replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a><br>') : ''));
  });

  const unique = new Map();
  for (const listing of perMessage.flat()) {
    unique.set(`${listing.source}:${listing.externalId}`, listing);
  }
  const listings = [...unique.values()];
  const { newListings, newMatches } = await ingestListings(req.user._id, listings);

  connection.lastSyncAt = new Date();
  await connection.save();

  const bySource = listings.reduce((acc, l) => ((acc[l.source] = (acc[l.source] || 0) + 1), acc), {});
  return res.json({
    success: true,
    emailsScanned: messageIds.length,
    listingsFound: listings.length,
    newListings,
    newMatches,
    bySource,
  });
}

/** DELETE /api/v1/gmail: revoke Google access and forget the token. */
export async function disconnectGmail(req, res) {
  const connection = await GmailConnection.findOne({ userId: req.user._id }).select('+encryptedRefreshToken');
  if (connection) {
    if (env.GMAIL_TOKEN_KEY) {
      try {
        await revokeToken(decryptToken(connection.encryptedRefreshToken, env.GMAIL_TOKEN_KEY));
      } catch {
        // still delete locally
      }
    }
    await connection.deleteOne();
  }
  return res.json({ success: true });
}
