"use client";

import { useState, useTransition } from "react";
import { TokenInput } from "@/components/TokenInput";
import { TITLE_SUGGESTIONS, KEYWORD_SUGGESTIONS, LOCATION_SUGGESTIONS } from "@/lib/suggestions";
import { updateSearchProfile } from "./actions";

export function ProfileForm({
  profileId,
  initial,
}: {
  profileId: string;
  initial: {
    titles: string[];
    keywords: string[];
    locations: string[];
    seniority: string;
    salaryMin: number | null;
    salaryMax: number | null;
  };
}) {
  const [titles, setTitles] = useState(initial.titles);
  const [keywords, setKeywords] = useState(initial.keywords);
  const [locations, setLocations] = useState(initial.locations);
  const [seniority, setSeniority] = useState(initial.seniority);
  const [salaryMin, setSalaryMin] = useState(initial.salaryMin?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(initial.salaryMax?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await updateSearchProfile(profileId, {
        titles,
        keywords,
        locations,
        seniority,
        salaryMin: salaryMin ? Number(salaryMin) : null,
        salaryMax: salaryMax ? Number(salaryMax) : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div>
      <TokenInput label="Target job titles" values={titles} onChange={setTitles} suggestions={TITLE_SUGGESTIONS} />
      <TokenInput label="Keywords" values={keywords} onChange={setKeywords} suggestions={KEYWORD_SUGGESTIONS} />
      <TokenInput label="Locations" values={locations} onChange={setLocations} suggestions={LOCATION_SUGGESTIONS} />

      <div className="mb-4 grid grid-cols-2 gap-3.5">
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
            <option value="lead">Lead</option>
            <option value="staff">Staff</option>
            <option value="principal">Principal</option>
            <option value="any">Any level</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">Salary range (annual)</label>
          <div className="flex items-center gap-2">
            <input
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="Min"
              className="w-full rounded-[9px] border border-border bg-bg px-3 py-2 text-[13.5px]"
            />
            <span className="text-ink-muted">–</span>
            <input
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="Max"
              className="w-full rounded-[9px] border border-border bg-bg px-3 py-2 text-[13.5px]"
            />
          </div>
        </div>
      </div>

      <button
        onClick={save}
        disabled={isPending}
        className="rounded-[9px] bg-sidebar px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
      </button>
    </div>
  );
}
