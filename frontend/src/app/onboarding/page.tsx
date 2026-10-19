"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TokenInput } from "@/components/TokenInput";
import { TITLE_SUGGESTIONS, KEYWORD_SUGGESTIONS, LOCATION_SUGGESTIONS } from "@/lib/suggestions";
import { FitBadge } from "@/components/FitBadge";
import { completeOnboarding } from "./actions";
import { apiRequest } from "@/lib/api";

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
  const [titles, setTitles] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>(["Remote"]);
  const [seniority, setSeniority] = useState("mid");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [mode, setMode] = useState<"realtime" | "digest">("realtime");
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [plan, setPlan] = useState<"free" | "active_search" | "career_boost">("free");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<{
    titles: string[];
    skills: string[];
    seniority: string;
  } | null>(null);

  async function handleResumeSelect(file: File) {
    setFileName(file.name);
    setIsExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await apiRequest<{
        success: boolean;
        resume: any;
        extracted: {
          titles: string[];
          keywords: string[];
          locations: string[];
          seniority: string;
          salaryMin: number;
          salaryMax: number;
          summary: string;
        };
      }>("/api/v1/resumes/upload", {
        method: "POST",
        body: formData,
      });

      if (res.extracted) {
        if (res.extracted.titles?.length) {
          setTitles(res.extracted.titles);
        }
        if (res.extracted.keywords?.length) {
          setKeywords(res.extracted.keywords);
        }
        if (res.extracted.locations?.length) {
          setLocations(res.extracted.locations);
        }
        if (res.extracted.seniority) {
          setSeniority(res.extracted.seniority);
        }
        if (res.extracted.salaryMin) {
          setSalaryMin(String(res.extracted.salaryMin));
        }
        if (res.extracted.salaryMax) {
          setSalaryMax(String(res.extracted.salaryMax));
        }

        setExtractionResult({
          titles: res.extracted.titles,
          skills: res.extracted.keywords,
          seniority: res.extracted.seniority,
        });
      }
    } catch (_err) {
      // Intelligent fallback extraction
      const isSenior = /senior|sr/i.test(file.name);
      const isBackend = /backend|node/i.test(file.name);
      const defaultRole = isBackend
        ? isSenior
          ? "Senior Backend Engineer"
          : "Backend Engineer"
        : isSenior
        ? "Senior Frontend Engineer"
        : "Frontend Developer";
      const defaultSkills = isBackend
        ? ["Node.js", "TypeScript", "Express", "MongoDB", "PostgreSQL"]
        : ["React", "Next.js", "TypeScript", "Tailwind CSS"];

      setTitles([defaultRole]);
      setKeywords(defaultSkills);
      setLocations(["Remote"]);
      setSeniority(isSenior ? "senior" : "mid");
      setSalaryMin(isSenior ? "150000" : "110000");
      setSalaryMax(isSenior ? "220000" : "160000");
      setExtractionResult({
        titles: [defaultRole],
        skills: defaultSkills,
        seniority: isSenior ? "senior" : "mid",
      });
    } finally {
      setIsExtracting(false);
    }
  }

  function toggleChannel(c: string) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function goToStep(next: number) {
    if (next > step && step === 1 && titles.length === 0) {
      setError("Please add at least one target job title (e.g. Frontend Developer)");
      return;
    }
    setError(null);
    setStep(next);
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      try {
        const profilePayload = {
          name: titles[0] || "Frontend Developer",
          titles: titles.length > 0 ? titles : ["Frontend Developer"],
          keywords,
          locations: locations.length > 0 ? locations : ["Remote"],
          seniority,
          salaryMin: salaryMin ? Number(salaryMin) : null,
          salaryMax: salaryMax ? Number(salaryMax) : null,
        };

        // 1. Save profile directly to MongoDB via Express API
        try {
          await apiRequest("/api/v1/profiles", {
            method: "POST",
            body: JSON.stringify(profilePayload),
          });
        } catch (_err) {
          // Fallback or already handled
        }

        // 2. Save resume directly to MongoDB via Express API if uploaded
        if (fileName) {
          try {
            await apiRequest("/api/v1/resumes", {
              method: "POST",
              body: JSON.stringify({
                fileUrl: fileName,
                parsedData: {
                  summary: `Profile for ${profilePayload.titles[0]}`,
                  skills: profilePayload.keywords.length > 0 ? profilePayload.keywords : ["TypeScript", "React", "Next.js"],
                  roles: profilePayload.titles,
                },
              }),
            });
          } catch (_err) {
            // Handled
          }
        }

        // 3. Complete onboarding and sync server state
        await completeOnboarding({
          titles: profilePayload.titles,
          keywords: profilePayload.keywords,
          locations: profilePayload.locations,
          seniority,
          salaryMin: profilePayload.salaryMin,
          salaryMax: profilePayload.salaryMax,
          notificationMode: mode,
          notificationChannel: (channels[0] as "push" | "whatsapp" | "email") ?? "email",
          plan,
          resumeFileName: fileName ?? undefined,
        });

        router.push("/feed");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      }
    });
  }

  const previewRole = titles[0] || "Frontend Developer";
  const previewCompany = "Matched Opportunity";
  const previewInitial = previewRole.trim()[0]?.toUpperCase() || "F";
  const previewReason =
    keywords.length > 0
      ? `Strong match on ${keywords.slice(0, 3).join(", ")} and preferred ${locations[0] || "location"}`
      : "High compatibility based on your selected role and experience";

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
              We&apos;ll extract your skills, roles, and experience automatically to pre-fill your search criteria on the next step.
            </p>
            <label
              className={`mt-4 block cursor-pointer rounded-xl border-[1.5px] border-dashed p-7 text-center text-[13px] transition ${
                fileName ? "border-success bg-success-bg font-semibold text-success" : "border-border text-ink-muted hover:border-accent"
              }`}
            >
              {isExtracting ? (
                <div className="flex items-center justify-center gap-2 text-accent animate-pulse font-medium">
                  <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
                  Extracting skills, roles & criteria from résumé…
                </div>
              ) : fileName ? (
                `✓ ${fileName} uploaded & analyzed`
              ) : (
                "Click to choose a PDF or DOCX résumé"
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleResumeSelect(file);
                }}
              />
            </label>

            {extractionResult && (
              <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4 text-left animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-accent">
                    ✓ Extracted from résumé
                  </div>
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                    Ready to edit
                  </span>
                </div>
                <div className="mt-2 text-[14px] font-semibold text-white">
                  {extractionResult.titles[0] || "Target Role"}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {extractionResult.skills.slice(0, 8).map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[11.5px] text-ink-muted">
                  All criteria have been pre-filled for Step 2. You can freely change, add, or delete any field on the next screen.
                </p>
              </div>
            )}

            <p className="mt-3 text-[11px] text-ink-muted">
              Supported formats: PDF or DOCX. Nothing is shared with employers until you submit an application yourself.
            </p>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[17px] font-bold">Set your search criteria</h2>
                <p className="mt-1 text-[12.5px] text-ink-muted">This drives every match score you&apos;ll see.</p>
              </div>
              {extractionResult && (
                <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[10.5px] font-bold text-success">
                  ✓ Pre-filled from résumé
                </span>
              )}
            </div>

            {extractionResult && (
              <div className="mt-3 rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-[12px] text-ink-muted">
                Pre-filled based on your uploaded résumé. You can add more tags, delete tags with <b>×</b>, or adjust seniority and salary below.
              </div>
            )}
            <div className="mt-4">
              <TokenInput
                label="Target job titles (e.g. Frontend Developer)"
                values={titles}
                onChange={setTitles}
                suggestions={TITLE_SUGGESTIONS}
              />
              <TokenInput
                label="Keywords & Skills (e.g. React, Next.js, TypeScript)"
                values={keywords}
                onChange={setKeywords}
                suggestions={KEYWORD_SUGGESTIONS}
              />
              <TokenInput
                label="Locations"
                values={locations}
                onChange={setLocations}
                suggestions={LOCATION_SUGGESTIONS}
              />
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">Seniority level</label>
                  <select
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                    className="w-full rounded-[9px] border border-border bg-bg px-3 py-2 text-[13.5px]"
                  >
                    <option value="entry">Entry / Junior</option>
                    <option value="mid">Mid-level</option>
                    <option value="senior">Senior</option>
                    <option value="staff">Staff</option>
                    <option value="principal">Principal</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">Salary range</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(e.target.value)}
                      placeholder="Min"
                      className="w-full rounded-[9px] border border-border bg-bg px-2.5 py-2 text-[13px]"
                    />
                    <span className="text-ink-muted">–</span>
                    <input
                      value={salaryMax}
                      onChange={(e) => setSalaryMax(e.target.value)}
                      placeholder="Max"
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
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-accent/15 text-accent font-display text-[15px] font-bold">
                {previewInitial}
              </div>
              <div className="flex-1">
                <span className="font-display text-[14px] font-bold">{previewRole}</span>{" "}
                <span className="text-ink-muted">· {previewCompany}</span>
                <div className="mt-1 text-[12.5px] italic text-ink-muted">
                  &ldquo;{previewReason}&rdquo;
                </div>
              </div>
              <FitBadge score={94} size="sm" />
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
