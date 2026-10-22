"use client";

import { forwardRef, useState } from "react";
import type { FieldError } from "react-hook-form";

export const inputClass =
  "w-full rounded-[9px] border bg-bg px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-muted focus:outline-none";

function borderClass(error?: FieldError) {
  return error ? "border-danger focus:border-danger" : "border-border focus:border-accent";
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  action,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  hint?: string;
  /** Optional element shown at the right of the label row (e.g. a "Forgot password?" link) */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-ink-muted">
          {label}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-[11.5px] text-danger">
          {error.message}
        </p>
      ) : (
        hint && <p className="mt-1 text-[11.5px] text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { error?: FieldError };

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { error, className = "", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && props.id ? `${props.id}-error` : undefined}
      className={`${inputClass} ${borderClass(error)} ${className}`}
      {...props}
    />
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(
  { error, className = "", ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={showPassword ? "text" : "password"}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && props.id ? `${props.id}-error` : undefined}
        className={`${inputClass} ${borderClass(error)} pr-10 ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-muted hover:text-ink"
        aria-label={showPassword ? "Hide password" : "Show password"}
        title={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  );
});
