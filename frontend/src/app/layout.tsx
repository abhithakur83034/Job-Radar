import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="font-body text-[14px] antialiased">{children}</body>
    </html>
  );
}
