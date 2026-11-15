import type { Metadata } from "next";
import "./globals.css";
import { siteOrigin } from "@/lib/site";
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  ...(siteOrigin() ? { metadataBase: new URL(siteOrigin()!) } : {}),
  title: "Reel Finisher",
  description: "Free photo, video and audio tools that run in your browser. Your files stay on your device.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
