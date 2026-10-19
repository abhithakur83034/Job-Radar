"use client";

import { useMemo, useRef, useState } from "react";

export function TokenInput({
  label,
  values,
  onChange,
  placeholder,
  suggestions,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Optional autocomplete source — typing filters this list; selecting one adds it as a token. Free text is always still allowed. */
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    if (!suggestions || !draft.trim()) return [];
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter((s) => !values.includes(s) && s.toLowerCase().includes(q))
      .slice(0, 8);
  }, [suggestions, draft, values]);

  const showDropdown = open && matches.length > 0;

  function addValue(value: string) {
    const trimmed = value.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft("");
    setOpen(false);
    setHighlight(-1);
  }

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">{label}</label>
      <div className="relative">
        <div className="flex flex-wrap gap-1.5 rounded-[9px] border border-border bg-bg p-2.5">
          {values.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[12px]"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="leading-none text-ink-muted"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={draft}
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
              setHighlight(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (showDropdown && e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, matches.length - 1));
                return;
              }
              if (showDropdown && e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
                return;
              }
              if (e.key === "Escape") {
                setOpen(false);
                setHighlight(-1);
                return;
              }
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                if (showDropdown && highlight >= 0) {
                  addValue(matches[highlight]);
                } else {
                  addValue(draft);
                }
              }
            }}
            onBlur={() => {
              addValue(draft);
              setOpen(false);
            }}
            placeholder={placeholder ?? "Type and press Enter"}
            className="min-w-[120px] flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>

        {showDropdown && (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-auto rounded-[9px] border border-border bg-surface py-1 shadow-lg">
            {matches.map((m, i) => (
              <li key={m}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addValue(m)}
                  className={`block w-full px-3 py-1.5 text-left text-[12.5px] ${
                    i === highlight ? "bg-accent-soft text-accent-soft-ink" : "hover:bg-surface-2"
                  }`}
                >
                  {m}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
