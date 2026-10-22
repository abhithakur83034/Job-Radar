"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme";

export type ThemeChoice = "system" | "light" | "dark";

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
    root.style.colorScheme = "";
  } else {
    root.setAttribute("data-theme", choice);
    root.style.colorScheme = choice;
  }
  try {
    if (choice === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Private mode / blocked storage: the theme still applies for this page view
  }
}

const OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "System theme",
    icon: <path d="M4 5h16v11H4zM9 20h6M12 16v4" />,
  },
  {
    value: "light",
    label: "Light theme",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  {
    value: "dark",
    label: "Dark theme",
    icon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  },
];

/** System / Light / Dark switch. `tone="sidebar"` for use on the always-dark sidebar. */
export function ThemeToggle({ tone = "surface" }: { tone?: "surface" | "sidebar" }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") setChoice(saved);
    } catch {
      // ignore
    }
  }, []);

  const base = tone === "sidebar" ? "border-white/10 bg-white/5" : "border-border bg-surface";
  const idle = tone === "sidebar" ? "text-sidebar-ink hover:text-white" : "text-ink-muted hover:text-ink";
  const active = "bg-accent text-accent-ink";

  return (
    <div role="radiogroup" aria-label="Theme" className={`inline-flex rounded-[9px] border p-0.5 ${base}`}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => {
            setChoice(o.value);
            applyTheme(o.value);
          }}
          className={`rounded-[7px] p-1.5 transition ${choice === o.value ? active : idle}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true">
            {o.icon}
          </svg>
        </button>
      ))}
    </div>
  );
}
