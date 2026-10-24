import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reel Finisher",
  description: "Caption talking-head videos in your browser. Your video stays on your device.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
