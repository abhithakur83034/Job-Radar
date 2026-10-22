/**
 * Helpers for the three sign-in identifiers: username, mobile number, email.
 */

// 3–30 chars, starts with a letter, letters/digits/dot/underscore. Starting with a
// letter guarantees a username can never be mistaken for a mobile number.
export const USERNAME_PATTERN = /^[a-z][a-z0-9._]{2,29}$/;

/**
 * Normalize a mobile number to E.164. A bare 10-digit Indian mobile number
 * (starting 6–9) gets the +91 country code; otherwise a +<country code> prefix is required.
 * Returns null when the input is not a plausible mobile number.
 */
export function normalizeMobile(input) {
  const raw = String(input ?? '').trim();
  if (!/^\+?[\d\s()-]+$/.test(raw)) return null;

  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  return null;
}

/** Decide which identifier a login value is, returning the Mongo query to find the user. */
export function identifierQuery(identifier) {
  const value = String(identifier ?? '').trim();
  if (value.includes('@')) return { email: value.toLowerCase() };

  const mobile = normalizeMobile(value);
  if (mobile) return { mobile };

  return { username: value.toLowerCase() };
}
