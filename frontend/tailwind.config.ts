import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        ink: "var(--text)",
        "ink-muted": "var(--text-muted)",
        sidebar: "var(--sidebar-bg)",
        "sidebar-top": "var(--sidebar-bg-top)",
        "sidebar-hover": "var(--sidebar-hover)",
        "sidebar-ink": "var(--sidebar-text)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-soft": "var(--accent-soft)",
        "accent-soft-ink": "var(--accent-soft-ink)",
        success: "var(--success)",
        "success-bg": "var(--success-bg)",
        danger: "var(--danger)",
        "danger-bg": "var(--danger-bg)",
        info: "var(--info)",
        "info-bg": "var(--info-bg)",
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
