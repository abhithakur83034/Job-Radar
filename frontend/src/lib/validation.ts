import type { RegisterOptions } from "react-hook-form";

// Mirrors backend/src/utils/identity.js and validators/auth.validators.js so users
// see the same rules before submitting. The backend remains the source of truth.

export const USERNAME_PATTERN = /^[a-z][a-z0-9._]{2,29}$/i;

/** Same rules as the backend's normalizeMobile: 10-digit Indian mobile, or +country code. */
export function isValidMobile(value: string): boolean {
  const raw = value.trim();
  if (!/^\+?[\d\s()-]+$/.test(raw)) return false;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15;
  if (digits.length === 10) return /^[6-9]/.test(digits);
  return digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2));
}

export const rules = {
  name: {
    required: "Name is required",
    maxLength: { value: 100, message: "Name must be under 100 characters" },
    validate: (v: string) => (v ?? "").trim().length > 0 || "Name is required",
  },
  username: {
    required: "Username is required",
    pattern: {
      value: USERNAME_PATTERN,
      message: "3–30 characters, start with a letter; letters, numbers, dots or underscores only",
    },
  },
  mobile: {
    required: "Mobile number is required",
    validate: (v: string) =>
      isValidMobile(v ?? "") || "Enter a 10-digit mobile number, or include the + country code",
  },
  email: {
    required: "Email is required",
    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" },
  },
  newPassword: {
    required: "Password is required",
    minLength: { value: 8, message: "Password must be at least 8 characters" },
    maxLength: { value: 128, message: "Password must be under 128 characters" },
  },
  password: { required: "Password is required" },
  identifier: { required: "Enter your username or mobile number" },
} satisfies Record<string, RegisterOptions<any, any>>;
