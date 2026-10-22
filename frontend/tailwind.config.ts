import type { Config } from "tailwindcss";

/**
 * Theme colours are CSS variables (switched by light/dark theme in globals.css).
 * Plain "var(--x)" colours make Tailwind drop opacity modifiers like bg-danger/10,
 * so mix with transparent instead when a modifier is used.
 */
function themeColor(variable: string) {
  // Tailwind substitutes <alpha-value> with the modifier (or 1 when there is none)
  return `color-mix(in srgb, var(${variable}) calc(<alpha-value> * 100%), transparent)`;
}

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: themeColor("--bg"),
        surface: themeColor("--surface"),
        "surface-2": themeColor("--surface-2"),
        border: themeColor("--border"),
        ink: themeColor("--text"),
        "ink-muted": themeColor("--text-muted"),
        sidebar: themeColor("--sidebar-bg"),
        "sidebar-top": themeColor("--sidebar-bg-top"),
        "sidebar-hover": themeColor("--sidebar-hover"),
        "sidebar-ink": themeColor("--sidebar-text"),
        accent: themeColor("--accent"),
        "accent-ink": themeColor("--accent-ink"),
        "accent-soft": themeColor("--accent-soft"),
        "accent-soft-ink": themeColor("--accent-soft-ink"),
        success: themeColor("--success"),
        "success-bg": themeColor("--success-bg"),
        danger: themeColor("--danger"),
        "danger-bg": themeColor("--danger-bg"),
        info: themeColor("--info"),
        "info-bg": themeColor("--info-bg"),
      },
      fontFamily: {
        display: ["'Space Grotesk'", "'Century Gothic'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "Consolas", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
