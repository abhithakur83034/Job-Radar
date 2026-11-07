"use client";

import type { ChangeEvent } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { PHONE_COUNTRIES, phoneCountry, sanitizeNational } from "@/lib/countries";

/**
 * Country code picker + national number, as two uncontrolled react-hook-form fields so
 * anything typed before hydration is kept. Combine them with joinMobile() on submit.
 */
export function MobileInput({
  id,
  country,
  countryField,
  numberField,
  error,
  placeholder = "Enter your mobile number",
}: {
  id: string;
  /** Currently selected country (from watch), used for the label and digit limit */
  country: string | undefined;
  countryField: UseFormRegisterReturn;
  numberField: UseFormRegisterReturn;
  error?: FieldError;
  placeholder?: string;
}) {
  const selected = phoneCountry(country);
  const border = error ? "border-danger focus-within:border-danger" : "border-border focus-within:border-accent";

  return (
    <div className={`flex w-full overflow-hidden rounded-[9px] border bg-bg ${border}`}>
      {/* Native select (best picker on phones), visually replaced by a compact "IN +91" label */}
      <div className="relative flex flex-none items-center gap-1 border-r border-border bg-surface-2 px-3 text-[13.5px] font-semibold text-ink">
        <span aria-hidden>
          <span className="text-ink-muted">{selected.iso}</span> +{selected.dial}
        </span>
        <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="text-ink-muted">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <select
          aria-label="Country code"
          defaultValue={selected.iso}
          {...countryField}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
      </div>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        maxLength={selected.maxDigits + 6} // room for a pasted "+91 " that sanitizeNational strips
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...numberField}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const clean = sanitizeNational(selected.iso, e.target.value);
          if (clean !== e.target.value) e.target.value = clean;
          return numberField.onChange(e);
        }}
        className="w-full min-w-0 bg-transparent px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-muted focus:outline-none"
      />
    </div>
  );
}
