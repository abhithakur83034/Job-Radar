/**
 * Helpers for the three sign-in identifiers: username, mobile number, email.
 */
import { parsePhoneNumberFromString, validatePhoneNumberLength } from 'libphonenumber-js/mobile';

// 3–30 chars, starts with a letter, letters/digits/dot/underscore. Starting with a
// letter guarantees a username can never be mistaken for a mobile number.
export const USERNAME_PATTERN = /^[a-z][a-z0-9._]{2,29}$/;

// Numbers without a +country code are read as Indian
const DEFAULT_COUNTRY = 'IN';
const PHONE_CHARS = /^\+?[\d\s().-]+$/;

/** The 10-digit part of an Indian number (typed bare, with a trunk 0, or with +91), else null. */
function indianNational(raw, digits) {
  const compact = raw.replace(/[\s().-]/g, '');
  if (compact.startsWith('+')) return compact.startsWith('+91') ? digits.slice(2) : null;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/**
 * Checks a mobile number against real numbering plans (libphonenumber's mobile
 * metadata), so landlines, unassigned ranges and wrong lengths are rejected.
 * @returns {{ ok: true, e164: string } | { ok: false, reason: 'format' | 'short' | 'long' | 'prefix' | 'invalid' | 'fake' }}
 */
export function checkMobile(input) {
  const raw = String(input ?? '').trim();
  if (!PHONE_CHARS.test(raw)) return { ok: false, reason: 'format' };

  const digits = raw.replace(/\D/g, '');
  const phone = parsePhoneNumberFromString(raw, DEFAULT_COUNTRY);
  if (!phone?.isValid()) {
    // More specific hints for the common case, an Indian number
    const national = indianNational(raw, digits);
    if (national !== null) {
      if (national.length < 10) return { ok: false, reason: 'short' };
      if (national.length > 10) return { ok: false, reason: 'long' };
      if (/^[0-5]/.test(national)) return { ok: false, reason: 'prefix' };
    } else if (validatePhoneNumberLength(raw, DEFAULT_COUNTRY) === 'TOO_SHORT') {
      return { ok: false, reason: 'short' };
    }
    return { ok: false, reason: 'invalid' };
  }
  // Valid by the numbering plan but obviously made up, e.g. 9999999999
  if (/^(\d)\1+$/.test(phone.nationalNumber)) return { ok: false, reason: 'fake' };

  return { ok: true, e164: phone.number };
}

/** Strict: the E.164 form of a valid mobile number, or null. Use when saving a number. */
export function normalizeMobile(input) {
  const result = checkMobile(input);
  return result.ok ? result.e164 : null;
}

/**
 * Lenient: E.164 form of anything shaped like a phone number, valid or not. Used only to
 * look up existing accounts at sign-in, so numbers saved under older, looser rules still match.
 */
function toE164(input) {
  const raw = String(input ?? '').trim();
  if (!PHONE_CHARS.test(raw) || raw.replace(/\D/g, '').length < 6) return null;
  return parsePhoneNumberFromString(raw, DEFAULT_COUNTRY)?.number ?? null;
}

/** Decide which identifier a login value is, returning the Mongo query to find the user. */
export function identifierQuery(identifier) {
  const value = String(identifier ?? '').trim();
  if (value.includes('@')) return { email: value.toLowerCase() };

  const mobile = toE164(value);
  if (mobile) return { mobile };

  return { username: value.toLowerCase() };
}
