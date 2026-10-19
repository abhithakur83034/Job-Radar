"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TokenInput } from "@/components/TokenInput";
import { TITLE_SUGGESTIONS, KEYWORD_SUGGESTIONS, LOCATION_SUGGESTIONS } from "@/lib/suggestions";
import { FitBadge } from "@/components/FitBadge";
import { completeOnboarding } from "./actions";

const STEPS = ["Résumé", "Search criteria", "Notifications", "Plan"];

const PLANS = [
  { key: "free" as const, label: "Free", detail: "3 tailored résumés/mo", price: "$0" },
  { key: "active_search" as const, label: "Active Search", detail: "Unlimited, real-time", price: "$18" },
  { key: "career_boost" as const, label: "Career Boost", detail: "+ multiple profiles", price: "$30" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [titles, setTitles] = useState<string[]>(["Senior Backend Engineer"]);
  const [keywords, setKeywords] = useState<string[]>(["Node.js", "TypeScript"]);
  const [locations, setLocations] = useState<string[]>(["Remote"]);
  const [seniority, setSeniority] = useState("senior");
  const [salaryMin, setSalaryMin] = useState("150000");
  const [salaryMax, setSalaryMax] = useState("220000");
  const [mode, setMode] = useState<"realtime" | "digest">("realtime");
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [plan, setPlan] = useState<"free" | "active_search" | "career_boost">("free");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(c: string) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function goToStep(next: number) {
    setError(null);
    setStep(next);
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      try {
        await completeOnboarding({
          titles,
          keywords,
          locations,
          seniority,
          salaryMin: salaryMin ? Number(salaryMin) : null,
          salaryMax: salaryMax ? Number(salaryMax) : null,
          notificationMode: mode,
          notificationChannel: (channels[0] as "push" | "whatsapp" | "email") ?? "email",
          plan,
        });
        router.push("/feed");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="relative w-full max-w-[560px] rounded-card border border-border bg-surface p-8">
        <button
          onClick={() => router.push("/feed")}
          aria-label="Close"
          className="absolute right-4 top-4 text-xl leading-none text-ink-muted hover:text-ink"
        >
          ×
        </button>

        <div className="mb-6 flex gap-1.5 pr-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-surface-2"}`} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <h2 className="font-display text-[17px] font-bold">Upload your résumé</h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              We&apos;ll extract your skills, roles, and experience automatically — nothing is
              shared until you submit an application yourself.
            </p>
            <label
              className={`mt-4 block cursor-pointer rounded-xl border-[1.5px] border-dashed p-7 text-center text-[13px] ${
                fileName ? "border-success bg-success-bg font-semibold text-success" : "border-border text-ink-muted"
              }`}
            >
              {fileName ? `✓ ${fileName} uploaded` : "Click to choose a PDF or DOCX résumé"}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </label>
            <p className="mt-2 text-[11px] text-ink-muted">
              Automatic skill extraction from the uploaded file lands in a later build phase — for now this
              step confirms the flow and the seeded demo profile carries a parsed résumé already.
            </p>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-display text-[17px] font-bold">Set your search criteria</h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">This drives every match score you&apos;ll see.</p>
            <div className="mt-4">
              <TokenInput label="Target job titles" values={titles} onChange={setTitles} suggestions={TITLE_SUGGESTIONS} />
              <TokenInput label="Keywords" values={keywords} onChange={setKeywords} suggestions={KEYWORD_SUGGESTIONS} />
              <TokenInput label="Locations" values={locations} onChange={setLocations} suggestions={LOCATION_SUGGESTIONS} />
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">Seniority level</label>
                  <select
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                    className="w-full rounded-[9px] border border-border bg-bg px-3 py-2 text-[13.5px]"
                  >
                    <option value="senior">Senior</option>
                    <option value="staff">Staff</option>
                    <option value="principal">Principal</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">Salary range</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(e.target.value)}
                      className="w-full rounded-[9px] border border-border bg-bg px-2.5 py-2 text-[13px]"
                    />
                    <span className="text-ink-muted">–</span>
                    <input
                      value={salaryMax}
                      onChange={(e) => setSalaryMax(e.target.value)}
                      className="w-full rounded-[9px] border border-border bg-bg px-2.5 py-2 text-[13px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-[17px] font-bold">Notification preferences</h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">How and when should JobRadar reach you?</p>
            <div className="mt-4 flex flex-col gap-2">
              {(["realtime", "digest"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-[13px] ${
                    mode === m ? "border-accent bg-accent-soft" : "border-border"
                  }`}
                >
                  <span>{m === "realtime" ? "Real-time alerts" : "Daily digest"}</span>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">Channel</label>
              <div className="flex gap-2">
                {["push", "whatsapp", "email"].map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleChannel(c)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold capitalize ${
                      channels.includes(c) ? "border-accent bg-accent-soft text-accent-soft-ink" : "border-border text-ink-muted"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-display text-[17px] font-bold">Choose your plan</h2>
            <div className="mt-4 flex flex-col gap-2">
              {PLANS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPlan(p.key)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-[13px] ${
                    plan === p.key ? "border-accent bg-accent-soft" : "border-border"
                  }`}
                >
                  <span>
                    <b>{p.label}</b> — {p.detail}
                  </span>
                  <span className="mono font-bold">{p.price}</span>
                </button>
              ))}
            </div>
            <div className="mb-2.5 mt-6 text-[11.5px] font-bold uppercase tracking-wide text-ink-muted">
              Preview — your first match would look like this
            </div>
            <div className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-surface-2 font-display text-[15px] font-bold">
                S
              </div>
              <div className="flex-1">
                <span className="font-display text-[14px] font-bold">Senior Backend Engineer</span>{" "}
                <span className="text-ink-muted">· Stripe</span>
                <div className="mt-1 text-[12.5px] italic text-ink-muted">
                  &ldquo;4/5 required skills present, role and location align&rdquo;
                </div>
              </div>
              <FitBadge score={92} size="sm" />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-[9px] border border-danger bg-danger-bg px-3.5 py-2.5 text-[12.5px] text-danger">
            {error}
          </div>
        )}

        <div className="mt-7 flex justify-between">
          <button
            onClick={() => goToStep(Math.max(0, step - 1))}
            className={`rounded-[9px] border border-border px-4 py-2 text-[13px] font-semibold ${step === 0 ? "invisible" : ""}`}
          >
            Back
          </button>
          <button
            onClick={() => (step === 3 ? finish() : goToStep(step + 1))}
            disabled={isPending}
            className="rounded-[9px] bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-60"
          >
            {isPending ? "Saving…" : step === 3 ? "Finish setup" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
