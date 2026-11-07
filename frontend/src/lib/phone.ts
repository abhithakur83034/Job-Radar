import { parsePhoneNumberFromString, validatePhoneNumberLength } from "libphonenumber-js/mobile";

// Mirrors checkMobile in backend/src/utils/identity.js. The backend remains the source of truth.

const DEFAULT_COUNTRY = "IN";
const PHONE_CHARS = /^\+?[\d\s().-]+$/;

/** The 10-digit part of an Indian number (typed bare, with a trunk 0, or with +91), else null. */
function indianNational(raw: string, digits: string): string | null {
  const compact = raw.replace(/[\s().-]/g, "");
  if (compact.startsWith("+")) return compact.startsWith("+91") ? digits.slice(2) : null;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** Returns an error message for an invalid mobile number, or null when it's valid. */
export function mobileError(value: string): string | null {
  const raw = value.trim();
  if (!PHONE_CHARS.test(raw)) {
    return "Mobile number can only contain digits";
  }

  const digits = raw.replace(/\D/g, "");
  const phone = parsePhoneNumberFromString(raw, DEFAULT_COUNTRY);
  if (!phone?.isValid()) {
    const national = indianNational(raw, digits);
    if (national !== null) {
      if (national.length < 10) return "Mobile number is too short. Enter all 10 digits";
      if (national.length > 10) return "Mobile number is too long. Indian numbers have 10 digits";
      if (/^[0-5]/.test(national)) return "Indian mobile numbers start with 6, 7, 8 or 9";
    } else if (validatePhoneNumberLength(raw, DEFAULT_COUNTRY) === "TOO_SHORT") {
      return "Mobile number is too short for the selected country";
    }
    return "Enter a valid mobile number for the selected country code. Landlines aren't accepted";
  }
  if (/^(\d)\1+$/.test(phone.nationalNumber)) return "Enter your real mobile number";
  return null;
}
