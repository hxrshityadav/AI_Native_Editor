import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site/SiteShell";
import { BenchmarkDashboard } from "@/components/transcription-evaluation/BenchmarkDashboard";
export const metadata:Metadata={title:"Transcription diagnostics · Reel Finisher",robots:{index:false,follow:false}};
export default function Page(){
  // No production override: private datasets are selected in the browser, never served by Next.
  if(process.env.NODE_ENV!=="development")notFound();
  return <SiteShell><BenchmarkDashboard /></SiteShell>;
}
