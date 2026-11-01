import Link from "next/link";
import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
export const viewport = siteViewport;
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/ui";

export const metadata: Metadata = {
  title: "Privacy · Reel Finisher",
  description: "How Reel Finisher processes and stores your video locally.",
  ...(siteOrigin() ? { alternates: { canonical: "/privacy" } } : {}),
};

export default function PrivacyPage() {
  return <SiteShell><main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <PageHeader title="Privacy" />
    <div className="mt-8 max-w-2xl space-y-5 leading-relaxed text-ink-2">
    <p>The standalone Video Compressor also runs entirely in your browser. It does not upload or persist your video. Download the result before closing or reloading the tab.</p>
    <p>The photo compressor, resizer and converter process files locally in your browser tab. They do not upload or persist your image files. Reloading or closing the tab clears the working image. Download a result to keep it.</p>
    <p>The studio edits, previews and exports your media in your browser. Core editing needs no account or paid AI service. Original video, audio and caption text are not uploaded by the local studio.</p>
    <p>Projects, imported media, fonts and optional speech models are saved in this browser’s storage. Clearing site data, private browsing or storage eviction can remove them. Keep your original files and download exports before clearing storage. Projects do not automatically sync between devices.</p>
    <p>Local transcription requires an optional model download after you choose it. The download requests static model files through this website; it does not send your media or transcript. Installed models can be reused offline. The website host receives ordinary page and asset requests, including network addresses; hosting access-log retention depends on the deployment.</p>
    <p>The default configuration disables cloud transcription and AI editing routes. A self-hosted deployment can explicitly enable the legacy cloud configuration, which has a separate provider disclosure before sending compressed speech audio. The local studio does not invoke those routes.</p>
    <p>The local editor disables analytics, cloud sharing and remote media services. Browser or operating-system services outside this application remain subject to your own settings.</p>
    <Link href="/supported-formats" className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-4">Supported formats and browser requirements</Link>
  </div></main></SiteShell>;
}
