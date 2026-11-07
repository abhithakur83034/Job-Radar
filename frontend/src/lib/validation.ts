import type { RegisterOptions } from "react-hook-form";
import { joinMobile } from "./countries";

// Mirrors backend/src/utils/identity.js and validators/auth.validators.js so users
// see the same rules before submitting. The backend remains the source of truth.

export const USERNAME_PATTERN = /^[a-z][a-z0-9._]{2,29}$/i;

/**
 * Same rules as the backend's checkMobile (real numbering plans, mobiles only).
 * The phone-number data is loaded on first use, so pages without a mobile field don't pay for it.
 */
export async function validateMobile(value: string): Promise<true | string> {
  const { mobileError } = await import("./phone");
  return mobileError(value ?? "") ?? true;
}

/** Validates the national number field of a MobileInput, using the form's selected country code. */
export function validateNationalMobile(national: string, values: { mobileCountry?: string }): Promise<true | string> {
  return validateMobile(joinMobile(values.mobileCountry, national));
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
    validate: validateNationalMobile,
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
