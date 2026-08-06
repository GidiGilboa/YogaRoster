import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Without this, Next falls back to inferring the image host itself rather
// than the incoming request's - in production that resolved to the app's
// own localhost:3000 bind address, so link-preview crawlers (WhatsApp,
// iMessage, etc.) couldn't resolve the relative og:image URL and silently
// showed a plain text/URL preview instead.
export const metadata: Metadata = {
  title: "Yoga Roster",
  description: "ניהול שיעורי יוגה ורישום תלמידים",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
