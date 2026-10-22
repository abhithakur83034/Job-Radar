"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { adminFetch, useAdminData } from "@/lib/admin";
import { Card, ErrorState, PageHeader, RowsSkeleton } from "@/components/admin/AdminUI";
import { FormField, TextInput } from "@/components/forms/FormField";

interface Settings {
  refreshEnabled: boolean;
  refreshIntervalMinutes: number;
  fetchConcurrency: number;
  fetchTimeoutMs: number;
  staleGraceDays: number;
  listingMaxAgeDays: number;
}

interface SettingsDetail {
  effective: Settings;
  defaults: Settings;
  overrides: Partial<Settings>;
}

// Same limits as the backend's settings schema (backend/src/config/runtimeSettings.js)
const NUMBER_FIELDS: { key: keyof Settings; label: string; min: number; max: number; hint: string }[] = [
  { key: "refreshIntervalMinutes", label: "Refresh interval (minutes)", min: 15, max: 1440, hint: "How often the background refresh checks sources. Each source's own limit still applies." },
  { key: "fetchConcurrency", label: "Sources fetched at once", min: 1, max: 10, hint: "Higher is faster but heavier on the server." },
  { key: "fetchTimeoutMs", label: "Request timeout (ms)", min: 1000, max: 60000, hint: "Per request to a job source." },
  { key: "staleGraceDays", label: "Close company-board jobs after (days missing)", min: 1, max: 60, hint: "A job a company stops listing is closed after this long." },
  { key: "listingMaxAgeDays", label: "Hide feed jobs older than (days)", min: 7, max: 180, hint: "For sources that can't report closed jobs." },
];

export default function AdminSettingsPage() {
  const { data, error, reload } = useAdminData<SettingsDetail>("/api/v1/admin/settings");
  const [saved, setSaved] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Settings>();

  useEffect(() => {
    if (data) reset(data.effective);
  }, [data, reset]);

  async function onSubmit(values: Settings) {
    setSaved(null);
    const changes = Object.fromEntries(
      Object.entries(values).filter(([k, v]) => data && data.effective[k as keyof Settings] !== v)
    );
    try {
      const updated = await adminFetch<SettingsDetail>("/api/v1/admin/settings", { method: "PATCH", body: JSON.stringify(changes) });
      reset(updated.effective);
      setSaved("Saved. Changes apply from the next refresh check.");
      reload();
    } catch (err: any) {
      setError("root", { message: err?.message || "Couldn't save settings" });
    }
  }

  async function resetToDefaults() {
    setSaved(null);
    try {
      const updated = await adminFetch<SettingsDetail>("/api/v1/admin/settings/reset", { method: "POST" });
      reset(updated.effective);
      setSaved("Reset to the environment defaults.");
      reload();
    } catch (err: any) {
      setError("root", { message: err?.message || "Couldn't reset settings" });
    }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Background job-refresh settings. Saved values override the server's environment defaults; every change is audited." />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <RowsSkeleton rows={5} />
      ) : (
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              <input type="checkbox" {...register("refreshEnabled")} className="h-4 w-4 accent-[var(--accent)]" />
              Background refresh enabled
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              {NUMBER_FIELDS.map((f) => (
                <FormField key={f.key} label={f.label} htmlFor={f.key} error={errors[f.key]} hint={`${f.hint} Default: ${data.defaults[f.key]}.`}>
                  <TextInput
                    id={f.key}
                    type="number"
                    inputMode="numeric"
                    min={f.min}
                    max={f.max}
                    error={errors[f.key]}
                    {...register(f.key, {
                      valueAsNumber: true,
                      required: "Required",
                      min: { value: f.min, message: `At least ${f.min}` },
                      max: { value: f.max, message: `At most ${f.max}` },
                      validate: (v) => Number.isInteger(v) || "Whole numbers only",
                    })}
                  />
                </FormField>
              ))}
            </div>

            {errors.root && <p role="alert" className="text-[12px] text-danger">{errors.root.message}</p>}
            {saved && <p role="status" className="text-[12px] text-success">{saved}</p>}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button type="submit" disabled={!isDirty || isSubmitting} className="rounded-[8px] bg-accent px-4 py-1.5 text-[12.5px] font-bold text-accent-ink disabled:opacity-50">
                {isSubmitting ? "Saving…" : "Save changes"}
              </button>
              {Object.keys(data.overrides).length > 0 && (
                <button type="button" onClick={resetToDefaults} className="rounded-[8px] border border-border px-4 py-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-ink">
                  Reset to defaults
                </button>
              )}
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
