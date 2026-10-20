import crypto from 'crypto';

/**
 * AES-256-GCM encryption for third-party OAuth tokens at rest. The key lives
 * only in the GMAIL_TOKEN_KEY env var (32 bytes, base64), never in the DB, so
 * a database leak alone does not expose users' Gmail access.
 */
function getKey(base64Key) {
  const key = Buffer.from(base64Key || '', 'base64');
  if (key.length !== 32) {
    throw new Error('GMAIL_TOKEN_KEY must be 32 bytes, base64-encoded');
  }
  return key;
}

export function encryptToken(plaintext, base64Key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(base64Key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // version:iv:tag:ciphertext
  return ['v1', iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptToken(payload, base64Key) {
  const [version, iv, tag, ciphertext] = String(payload).split(':');
  if (version !== 'v1' || !iv || !tag || !ciphertext) {
    throw new Error('Unrecognized encrypted token format');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(base64Key), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
