"use client";

import { useMemo, useRef, useState } from "react";

const MAX_TOKEN_LENGTH = 80;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

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

  const typed = draft.trim().slice(0, MAX_TOKEN_LENGTH);
  const alreadyAdded = typed !== "" && values.some((v) => same(v, typed));

  // Dropdown options: the typed text itself first (so it's clear any value can be added),
  // then matching suggestions
  const options = useMemo(() => {
    if (!typed) return [];
    const q = typed.toLowerCase();
    const matches = (suggestions ?? [])
      .filter((s) => !values.some((v) => same(v, s)) && s.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)))
      .slice(0, 8);
    const exact = matches.find((s) => same(s, typed));
    if (exact || alreadyAdded) return matches.map((value) => ({ value, custom: false }));
    return [{ value: typed, custom: true }, ...matches.map((value) => ({ value, custom: false }))];
  }, [suggestions, typed, values, alreadyAdded]);

  const showDropdown = open && options.length > 0;

  function addValue(value: string) {
    const trimmed = value.trim().slice(0, MAX_TOKEN_LENGTH);
    if (trimmed && !values.some((v) => same(v, trimmed))) {
      // Prefer the suggestion's casing when the typed text matches one ("php developer" → "PHP Developer")
      const canonical = suggestions?.find((s) => same(s, trimmed)) ?? trimmed;
      onChange([...values, canonical]);
    }
    setDraft("");
    setOpen(false);
    setHighlight(-1);
  }

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">{label}</label>
      <div className="relative">
        <div
          className="flex cursor-text flex-wrap gap-1.5 rounded-[9px] border border-border bg-bg p-2.5"
          onClick={() => inputRef.current?.focus()}
        >
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
            enterKeyHint="enter"
            maxLength={MAX_TOKEN_LENGTH}
            onChange={(e) => {
              const next = e.target.value;
              // Mobile keyboards don't always report the comma key, so also split on a typed comma
              if (next.includes(",")) {
                const parts = next.split(",");
                const rest = parts.pop() ?? "";
                const added = [...values];
                for (const p of parts) {
                  const t = p.trim();
                  if (t && !added.some((v) => same(v, t))) added.push(suggestions?.find((s) => same(s, t)) ?? t);
                }
                if (added.length !== values.length) onChange(added);
                setDraft(rest);
              } else {
                setDraft(next);
              }
              setOpen(true);
              setHighlight(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (showDropdown && e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, options.length - 1));
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
              if (e.key === "Backspace" && draft === "" && values.length > 0) {
                onChange(values.slice(0, -1));
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                addValue(showDropdown && highlight >= 0 ? options[highlight].value : draft);
              }
            }}
            onBlur={() => {
              addValue(draft);
              setOpen(false);
            }}
            placeholder={values.length ? "Add another…" : placeholder ?? "Type and press Enter"}
            className="min-w-[120px] flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>

        {alreadyAdded && open && (
          <p className="mt-1 text-[11.5px] text-ink-muted">&ldquo;{typed}&rdquo; is already added.</p>
        )}

        {showDropdown && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-auto rounded-[9px] border border-border bg-surface py-1 shadow-lg"
          >
            {options.map((o, i) => (
              <li key={`${o.custom ? "custom:" : ""}${o.value}`} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addValue(o.value)}
                  className={`block w-full px-3 py-1.5 text-left text-[12.5px] ${
                    i === highlight ? "bg-accent-soft text-accent-soft-ink" : "hover:bg-surface-2"
                  }`}
                >
                  {o.custom ? (
                    <>
                      Add <b>&ldquo;{o.value}&rdquo;</b>
                    </>
                  ) : (
                    o.value
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
