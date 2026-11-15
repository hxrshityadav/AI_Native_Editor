import Link from "next/link";
import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
export const viewport = siteViewport;
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/ui";
import styles from "@/components/tools/surface/ToolSurface.module.css";

export const metadata: Metadata = {
  title: "Privacy · Reel Finisher",
  description: "How Reel Finisher processes and stores your video locally.",
  ...(siteOrigin() ? { alternates: { canonical: "/privacy" } } : {}),
};

export default function PrivacyPage() {
  return <SiteShell><main className="reading-page">
    <PageHeader title="Privacy" lead="Understand what stays in this tab, what this browser saves, and what the website host receives." />
    <section className={styles.readingGrid}>
    <nav aria-label="On this page" className={styles.readingToc}>
      <a href="#local-processing">Local processing</a><a href="#optional-models">Optional models</a><a href="#browser-storage">Browser storage</a><a href="#website-requests">Website requests</a>
    </nav>
    <div className={styles.readingBody}>
    <section id="local-processing" className={styles.readingSection}>
    <h2>Local processing</h2>
    <p>The standalone Video Compressor also runs entirely in your browser. It does not upload or persist your video. Download the result before closing or reloading the tab.</p>
    <p>The photo compressor, resizer and converter process files locally in your browser tab. They do not upload or persist your image files. Reloading or closing the tab clears the working image. Download a result to keep it.</p>
    <p>The audio, video and AI tools also process files in this tab. None of them needs an account or a paid AI service, and none uploads your media, documents or transcripts. Browser or operating-system services outside this website remain subject to your own settings.</p>
    </section>
    <section id="optional-models" className={styles.readingSection}>
    <h2>Optional models and local AI</h2>
    <p>The local transcription, subtitle translation and English dubbing tools can download public Whisper and SpeechT5 model files after your explicit choice. Subtitle Studio asks separately for Whisper Tiny (about 95 MiB) or Whisper Base (about 140 MiB), both with word timing. Fonts you upload to Subtitle Studio stay in this browser. These asset requests contain no recording or transcript. Additional subtitle languages use supported browsers’ on-device translation packs. Speech generation uses a generic voice, without voice cloning. Light noise reduction and stereo centre/side separation use local signal processing. Script cards and photo animations are rendered locally, without generative video services.</p>
    <p>Standalone speech generation uses the same local SpeechT5 engine as narration, with explicit model-download consent. Device listening offers only installed local voices. Neural noise cleanup optionally loads the RNNoise runtime and its embedded model from this site; audio stays inside a dedicated worker. Neither feature sends text or recordings for remote processing.</p>
    <p>Lecture to Notes uses local Whisper and source-based extractive notes, not an external LLM. PDF to Audio extracts selectable text locally and uses the same English speech engine. Documents, transcripts and notes are held in this tab, without automatic persistence. Download your results before leaving or reloading. Scanned PDFs are not sent to an OCR service.</p>
    </section>
    <section id="browser-storage" className={styles.readingSection}>
    <h2>What this browser saves</h2>
    <p>Downloaded speech models use pinned revisions and a separate, versioned public-model cache. It contains public model assets, not documents, media or transcripts, and it is kept separate from other site storage. Browser quota, private mode or storage eviction can prevent persistence. Cached models can be reused with model downloads unavailable while the tool and runtime assets are available; the website does not install a root service worker or guarantee a complete offline website reload.</p>
    <p>Optional speech models and your Command Center preferences (pinned tools, recently opened tool pages and the theme) are saved in this browser’s storage. Files you process are not saved. Clearing site data, private browsing or storage eviction can remove what is stored; nothing syncs between devices.</p>
    </section>
    <section id="website-requests" className={styles.readingSection}>
    <h2>Website and asset requests</h2>
    <p>Local transcription requires an optional model download after you choose it. The download requests static model files through this website; it does not send your media or transcript. Installed models can be reused offline. The website host receives ordinary page and asset requests, including network addresses; hosting access-log retention depends on the deployment.</p>
    </section>
    <nav aria-label="Next steps" className={styles.readingLinks}><Link prefetch={false} href="/supported-formats">Supported formats and browser requirements</Link><Link prefetch={false} href="/tools">Explore the tools</Link></nav>
  </div></section></main></SiteShell>;
}

