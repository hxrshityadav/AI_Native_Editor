import Link from "next/link";
import type { Metadata } from "next";
import { siteOrigin } from "@/lib/site";

export const metadata: Metadata = {
  title: "Supported formats · Reel Finisher",
  description: "Video limits, local export formats and browser requirements for Reel Finisher.",
  ...(siteOrigin() ? { alternates: { canonical: "/supported-formats" } } : {}),
};

export default function FormatsPage() {
  return <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
    <Link href="/" className="underline">Reel Finisher</Link>
    <h1 className="text-3xl font-semibold">Supported formats</h1>
    <p>Videos must have a readable duration of 10 minutes or less. Video exports are also limited to a 10-minute project. Available memory and browser storage can impose lower practical limits, especially on phones.</p>
    <p>Start with H.264 video and AAC audio in an MP4 file on desktop Chrome or Edge. WebM with VP9 and Opus is another browser-dependent option. A file extension alone does not establish codec support. HEVC, HDR, ProRes and unusual MOV codecs are not guaranteed; convert an unsupported file locally before importing.</p>
    <p>Video export uses WebCodecs and the browser’s installed encoders. Hardware and operating-system codec support vary. If an encoder is unavailable, choose a supported format or another browser. No server conversion or FFmpeg fallback is provided.</p>
    <p>Use HTTPS or localhost. Local speech recognition uses WebAssembly and optional downloaded models. The studio uses cross-origin isolation for shared memory. GPU acceleration is optional where a browser fallback exists; advanced GPU effects may require compatible hardware. Audio playback requires a user gesture.</p>
    <p>Desktop Chrome and Edge are the primary test targets. Other browsers and mobile devices may support only part of the workflow. Keep original media when moving between browsers.</p>
    <p>Ripple removal of an In/Out range closes that time across video, audio, captions and overlays. Affected locked tracks and unsupported advanced compositions are rejected before changes. Ordinary Delete leaves empty time; deleting caption text is a separate operation.</p>
    <nav aria-label="Next steps" className="flex gap-4 underline"><Link href="/studio">Open the studio</Link><Link href="/privacy">Privacy</Link></nav>
  </main>;
}
