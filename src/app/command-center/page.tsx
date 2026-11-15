import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { CommandCenter } from "@/components/command-center/CommandCenter";
import { siteOrigin, siteViewport } from "@/lib/site";

export const viewport = siteViewport;
export const metadata: Metadata = { title: "Command Center · Reel Finisher", description: "Find media tools, pin favorites and revisit tools locally, without an account.", robots: { index: false, follow: true }, ...(siteOrigin() ? { alternates: { canonical: "/command-center" } } : {}) };
export default function Page() { return <SiteShell><CommandCenter /></SiteShell>; }
