import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://meetingdatetime.thequietachievr.com"
).replace(/\/$/, "");

const siteDescription =
  "Find the best overlapping meeting time across cities — anchored to your master city, with daylight-saving change callouts.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Meeting Date Time · The Quiet Achiever",
  description: siteDescription,
  openGraph: {
    type: "website",
    locale: "en_AU",
    siteName: "Meeting Date Time",
    title: "Meeting Date Time",
    description: siteDescription,
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: "Meeting Date Time",
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
