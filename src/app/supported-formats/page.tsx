import Link from "next/link";
import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
export const viewport = siteViewport;
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/ui";

export const metadata: Metadata = {
  title: "Supported formats · Reel Finisher",
  description: "Video limits, local export formats and browser requirements for Reel Finisher.",
  ...(siteOrigin() ? { alternates: { canonical: "/supported-formats" } } : {}),
};

export default function FormatsPage() {
  return <SiteShell><main className="reading-page">
    <PageHeader title="Supported formats" />
    <div className="mt-8 max-w-2xl space-y-5 leading-relaxed text-ink-2">
    <p>Videos must have a readable duration of 10 minutes or less. Video exports are also limited to a 10-minute project. Available memory and browser storage can impose lower practical limits, especially on phones.</p>
    <p>Start with H.264 video and AAC audio in an MP4 file on desktop Chrome or Edge. WebM with VP9 and Opus is another browser-dependent option. A file extension alone does not establish codec support. HEVC, HDR, ProRes and unusual MOV codecs are not guaranteed; convert an unsupported file locally before importing.</p>
    <p>Video export uses WebCodecs and the browser’s installed encoders. Hardware and operating-system codec support vary. If an encoder is unavailable, choose a supported format or another browser. No server conversion or FFmpeg fallback is provided.</p>
    <p>Use HTTPS or localhost. Local speech recognition uses WebAssembly and optional downloaded models. The studio uses cross-origin isolation for shared memory. GPU acceleration is optional where a browser fallback exists; advanced GPU effects may require compatible hardware. Audio playback requires a user gesture.</p>
    <p>Desktop Chrome and Edge are the primary test targets. Other browsers and mobile devices may support only part of the workflow. Keep original media when moving between browsers.</p>
    <h2 className="pt-4 text-xl">Local speech and creator tools</h2>
    <p>Downloadable speech uses one generic English SpeechT5 voice and PCM WAV. Standalone jobs accept up to 500 characters and 60 seconds of generated audio. The current q8 encoder, full-precision decoder and HiFiGAN weights total about 370 MiB, plus runtime/config files. Generation is CPU/WASM based, can be slower than playback and needs substantial memory. Preview pronunciation and wording before using a result. Physical-phone memory limits and broad voice-quality testing remain unverified.</p>
    <p>Shorts Maker and Lecture to Notes accept supported audio/video containers up to 512 MiB and ten minutes. Shorts require video and prepare a selected 0.1–60-second range for a separate Studio project. Optional Whisper assets are about 100 MB. Transcript segment times need review; moment suggestions and notes use deterministic/extractive methods rather than an LLM. Existing cleanup and dubbing tools retain their more conservative two-minute limits.</p>
    <p>Neural noise cleanup supports mono and stereo recording audio through RNNoise, with optional copied-picture video output where codecs permit. Its versioned runtime and embedded model are about 122 KiB. Light spectral reduction and stereo centre/side extraction remain available; the stereo method is not neural vocal separation.</p>
    <h2 className="pt-4 text-xl">PDF to Audio</h2>
    <p>Use a text-based PDF up to ten MiB, fifty pages and 100,000 extracted characters. Password-protected and scanned-only documents are unsupported; no OCR runs. Review page order, columns, tables and unusual fonts. Select pages, edit a section of up to 5,000 characters and generate English speech in short sentence-based segments, with a ten-minute output ceiling. Download each selection before replacing it. No PDF is uploaded.</p>
    <p>Ripple removal of an In/Out range closes that time across video, audio, captions and overlays. Affected locked tracks and unsupported advanced compositions are rejected before changes. Ordinary Delete leaves empty time; deleting caption text is a separate operation.</p>
    <nav aria-label="Next steps" className="flex flex-wrap gap-x-5 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center font-medium text-brand underline underline-offset-4"><Link href="/studio">Open the studio</Link><Link href="/privacy">Privacy</Link></nav>
  </div></main></SiteShell>;
}

