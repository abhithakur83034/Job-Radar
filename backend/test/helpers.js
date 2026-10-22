import crypto from 'crypto';

/** Deterministic, unique username + Indian mobile number for a test email. */
export function identityFor(email) {
  const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest();
  const username = `u${hash.toString('hex').slice(0, 12)}`;
  const mobile = `9${(hash.readUInt32BE(0) % 1e9).toString().padStart(9, '0')}`;
  return { username, mobile };
}
