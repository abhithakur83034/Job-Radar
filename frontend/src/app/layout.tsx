import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "JobRadar",
  description: "Job opening radar & tailored-application assistant",
};

// viewport-fit=cover exposes env(safe-area-inset-*) so the bottom tab bar clears the iPhone home indicator
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script may set data-theme before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-bg font-body text-[14px] text-ink antialiased">{children}</body>
    </html>
  );
}
