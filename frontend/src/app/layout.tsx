import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobRadar",
  description: "Job opening radar & tailored-application assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body text-[14px] antialiased">{children}</body>
    </html>
  );
}
