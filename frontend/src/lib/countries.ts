// Country codes offered by the mobile number picker. Kept small and dependency-free so
// the sign-up page doesn't load phone metadata up front; numbers are fully validated
// (libphonenumber) by validateMobile and again by the backend.

export interface PhoneCountry {
  iso: string;
  name: string;
  dial: string;
  /** Most digits a mobile number has in this country, after the country code */
  maxDigits: number;
}

export const DEFAULT_PHONE_COUNTRY = "IN";

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "IN", name: "India", dial: "91", maxDigits: 10 },
  { iso: "US", name: "United States / Canada", dial: "1", maxDigits: 10 },
  { iso: "GB", name: "United Kingdom", dial: "44", maxDigits: 10 },
  { iso: "AE", name: "United Arab Emirates", dial: "971", maxDigits: 9 },
  { iso: "SA", name: "Saudi Arabia", dial: "966", maxDigits: 9 },
  { iso: "QA", name: "Qatar", dial: "974", maxDigits: 8 },
  { iso: "KW", name: "Kuwait", dial: "965", maxDigits: 8 },
  { iso: "OM", name: "Oman", dial: "968", maxDigits: 8 },
  { iso: "BH", name: "Bahrain", dial: "973", maxDigits: 8 },
  { iso: "SG", name: "Singapore", dial: "65", maxDigits: 8 },
  { iso: "MY", name: "Malaysia", dial: "60", maxDigits: 10 },
  { iso: "AU", name: "Australia", dial: "61", maxDigits: 9 },
  { iso: "NZ", name: "New Zealand", dial: "64", maxDigits: 10 },
  { iso: "DE", name: "Germany", dial: "49", maxDigits: 11 },
  { iso: "FR", name: "France", dial: "33", maxDigits: 9 },
  { iso: "NL", name: "Netherlands", dial: "31", maxDigits: 9 },
  { iso: "IE", name: "Ireland", dial: "353", maxDigits: 9 },
  { iso: "ZA", name: "South Africa", dial: "27", maxDigits: 9 },
  { iso: "JP", name: "Japan", dial: "81", maxDigits: 10 },
  { iso: "HK", name: "Hong Kong", dial: "852", maxDigits: 8 },
  { iso: "NP", name: "Nepal", dial: "977", maxDigits: 10 },
  { iso: "BD", name: "Bangladesh", dial: "880", maxDigits: 10 },
  { iso: "LK", name: "Sri Lanka", dial: "94", maxDigits: 9 },
  { iso: "PK", name: "Pakistan", dial: "92", maxDigits: 10 },
];

export function phoneCountry(iso: string | undefined): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.iso === iso) ?? PHONE_COUNTRIES[0];
}

/** "+919876543210" → { country: "IN", national: "9876543210" }. Unknown codes fall back to India. */
export function splitMobile(e164: string | null | undefined): { country: string; national: string } {
  const digits = (e164 ?? "").replace(/\D/g, "");
  if (!e164?.trim().startsWith("+") || !digits) return { country: DEFAULT_PHONE_COUNTRY, national: digits };
  // Longest dial code first so "+971…" isn't read as "+97…"
  const match = [...PHONE_COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => digits.startsWith(c.dial));
  return match
    ? { country: match.iso, national: digits.slice(match.dial.length) }
    : { country: DEFAULT_PHONE_COUNTRY, national: digits };
}

/** { country: "IN", national: "98765 43210" } → "+919876543210"; empty when no number was typed. */
export function joinMobile(country: string | undefined, national: string | undefined): string {
  const digits = (national ?? "").replace(/\D/g, "");
  return digits ? `+${phoneCountry(country).dial}${digits}` : "";
}

/**
 * Digits only, capped at the country's length. Also strips a pasted trunk "0" or the
 * country code itself ("+91 98765 43210" pasted with India selected → "9876543210").
 */
export function sanitizeNational(country: string | undefined, value: string): string {
  const { dial, maxDigits } = phoneCountry(country);
  let digits = value.replace(/\D/g, "");
  if (digits.length > maxDigits && digits.startsWith(dial)) digits = digits.slice(dial.length);
  if (digits.length > maxDigits && digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, maxDigits);
}
