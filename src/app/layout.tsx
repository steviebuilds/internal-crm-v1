import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wahlu CRM",
  description: "Company-first CRM for outreach, follow-ups, and pipeline management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
