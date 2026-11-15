import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ChevronRight, Cpu, Plus, ShieldCheck } from "lucide-react";
import { siteOrigin, siteViewport } from "@/lib/site";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/lib/tools/catalog";
import { commandTools } from "@/lib/command-center/catalog";
import { SiteShell } from "@/components/site/SiteShell";
import { FinishingBench } from "@/components/site/FinishingBench";
import { CommandPreview } from "@/components/site/home/CommandPreview";
import { buttonClass } from "@/components/site/ui";
import { TOOL_ICONS } from "@/components/site/toolIcons";
import "@/components/site/home/home.css";

export const viewport = siteViewport;
export const metadata: Metadata = { title: "Reel Finisher · Photo, video and audio tools in your browser", description: "Free photo, video and audio tools with local browser processing. Compress, convert, cut, clean and caption without a mandatory account or a watermark.", ...(siteOrigin() ? { alternates: { canonical: "/" } } : {}) };

const FEATURED = ["/tools/image-compressor", "/tools/video-compressor", "/tools/heic-to-jpg", "/tools/audio-cutter", "/tools/noise-remover", "/tools/transcribe-to-text"];

/** Download sizes from docs/local-models.md; each model downloads only after the visitor agrees. */
const MODELS = [
  { name: "SpeechT5 + HiFi-GAN", job: "English speech from text and PDFs", size: "370 MiB", bytes: 388_321_010, color: "var(--chart-amber)", href: "/tools/text-to-speech" },
  { name: "Whisper Tiny", job: "Speech to text, translation, lecture notes", size: "91 MiB", bytes: 95_734_369, color: "var(--chart-coral)", href: "/tools/transcribe-to-text" },
  { name: "U²-Net-p", job: "Background removal", size: "≈19 MB", bytes: 19_000_000, color: "var(--chart-mint)", href: "/tools/background-remover" },
  { name: "RNNoise", job: "Speech noise cleanup", size: "124 KB", bytes: 124_406, color: "var(--chart-lime)", href: "/tools/noise-remover" },
];
const LARGEST = Math.max(...MODELS.map(model => model.bytes));

/** Each step is a real tool; the sequence is a suggestion, not an automated pipeline. */
const WORKFLOWS = [
  { title: "Clean up a talking-head clip", steps: [["Noise Remover", "/tools/noise-remover"], ["Trim Video", "/tools/trim-video"], ["Compress Video", "/tools/video-compressor"]] },
  { title: "iPhone photos for a website", steps: [["HEIC to JPG", "/tools/heic-to-jpg"], ["Resize Image", "/tools/image-resizer"], ["Compress Image", "/tools/image-compressor"]] },
  { title: "A podcast clip for social", steps: [["Audio Cutter", "/tools/audio-cutter"], ["Increase Volume", "/tools/increase-volume"], ["Audio to Video", "/tools/audio-to-video"]] },
  { title: "A lecture into study notes", steps: [["Noise Remover", "/tools/noise-remover"], ["Lecture to Notes", "/tools/lecture-to-notes"]] },
];

const FAQ = [
  { q: "Are my files uploaded?", a: "No. The photo, video, audio and AI tools process your file in this browser tab. If a feature ever needs a server, it says where the data goes before anything is sent." },
  { q: "What does it cost?", a: "The tools are free to use without an account, and exports carry no watermark." },
  { q: "Why do some AI tools download a model?", a: "The model has to be on your device to run there. It downloads once, after you agree, and is cached in this browser. Your media and text are never sent with the download." },
  { q: "How long can a video be?", a: "Up to ten minutes. Some tools set a lower limit, and each states its limit before you choose a file." },
  { q: "Which browser works best?", a: "A current desktop Chrome or Edge supports every tool. Each tool checks what your browser can decode and encode, and says so before it starts if something is missing." },
];

/** Curated from the tool catalog and /supported-formats; input on the left, what tools write on the right. */
const FORMATS: [string, string, string?][] = [
  ["Photos", "JPEG · PNG · WebP · HEIC · HEIF", "JPEG · PNG · WebP"],
  ["Video", "MP4 · MOV · WebM · MKV", "MP4 · WebM · GIF"],
  ["Audio", "MP3 · WAV · M4A · Ogg · Opus · FLAC", "M4A · WAV · Ogg"],
  ["Documents", "PDF with embedded text, up to 50 pages", "WAV speech · TXT · Markdown"],
  ["Limits", "Video up to 10 minutes; each tool states its own"],
];

const BLURB: Record<ToolCategory, string> = { photo: "Compress, resize, convert, cut out and crop.", video: "Compress, trim, convert and make GIFs.", audio: "Cut, convert, clean, boost and narrate.", ai: "Transcribe, translate, dub and summarise, locally." };

export default function Home() {
  const featured = FEATURED.map(href => TOOLS.find(tool => tool.href === href)).filter(tool => !!tool);
  return <SiteShell><main className="home-page public-page">
    <div className="home-columns">
      <div className="home-col">
        <section style={{ order: 1 }} className="panel home-hero" aria-labelledby="home-title">
        <h1 id="home-title">Media tools that run in your browser</h1>
        <p className="hero-lead">{commandTools.length} photo, video and audio tools for creators and everyday files. Compress, convert, cut, clean and caption without installing anything, and your files stay on your device.</p>
        <p className="hero-facts"><span>Free</span><span>No account</span><span>No watermark</span><span>Runs locally</span></p>
        <div className="hero-actions">
          <Link prefetch={false} href="/tools" className={buttonClass("primary")}>Explore tools<ArrowRight aria-hidden size={17} /></Link>
          <Link prefetch={false} href="/command-center" className={buttonClass("secondary")}>Open Command Center</Link>
        </div>
        <div className="panel-inset hero-bench"><FinishingBench /></div>
      </section>
        <section style={{ order: 3 }} className="panel" aria-labelledby="categories-heading">
        <div className="panel-head"><h2 id="categories-heading">Tool categories</h2><Link prefetch={false} href="/tools" className={buttonClass("secondary")}>All {commandTools.length} tools</Link></div>
        <ul className="category-grid">{CATEGORIES.map(category => { const count = commandTools.filter(tool => tool.category === category.id).length; return <li key={category.id}><Link prefetch={false} href={`/tools?category=${category.id}`} className="category-card">
          <span className="panel-inset category-picture"><picture><source media="(max-width: 767px)" srcSet={`/illustrations/${category.id}-compact.webp`} /><img src={`/illustrations/${category.id}.webp`} alt="" width={1040} height={520} loading="lazy" decoding="async" /></picture></span>
          <strong>{category.id === "ai" ? "AI tools" : category.title}</strong>
          <span className="category-blurb">{BLURB[category.id]}</span>
          <span className="meta">{count} tools</span>
        </Link></li>; })}</ul>
      </section>
        <section style={{ order: 5 }} className="panel" aria-labelledby="workflows-heading">
        <div className="panel-head"><h2 id="workflows-heading">Popular workflows</h2></div>
        <p className="panel-lead">Chain tools for common jobs. Each step is its own tool, so you download in between and nothing is kept.</p>
        <ul className="workflow-list">{WORKFLOWS.map(flow => <li key={flow.title}><h3>{flow.title}</h3><ol>{flow.steps.map(([label, href]) => <li key={href}><Link prefetch={false} href={href}>{label}</Link></li>)}</ol></li>)}</ul>
      </section>
        <section style={{ order: 9 }} className="panel home-faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">Questions</h2>
        <div>{FAQ.map(item => <details key={item.q}><summary>{item.q}<Plus aria-hidden size={18} strokeWidth={1.75} /></summary><p>{item.a}</p></details>)}</div>
      </section>
      </div>
      <div className="home-col">
        <section style={{ order: 2 }} className="panel" aria-labelledby="command-heading">
          <div className="panel-head"><h2 id="command-heading">Find a tool</h2><kbd>Ctrl K</kbd></div>
          <p className="panel-lead">Search by name, task or file format.</p>
          <CommandPreview compact />
        </section>
        <section style={{ order: 4 }} className="panel" aria-labelledby="models-heading">
          <div className="panel-head"><h2 id="models-heading"><Cpu aria-hidden size={18} strokeWidth={1.75} />Local AI models</h2></div>
          <p className="panel-lead">Each one asks before it downloads, then runs from this browser.</p>
          <p className="meta chart-caption">Download size · linear scale · from docs/local-models.md</p>
          <ul className="rows">{MODELS.map(model => <li key={model.name}><Link prefetch={false} href={model.href} className="row-link model-row"><span className="row-text">{model.name}<small>{model.job}</small><span className="size-bar" aria-hidden><span style={{ width: `${Math.max(1.5, model.bytes / LARGEST * 100)}%`, background: model.color }} /></span></span><span className="meta">{model.size}</span><ChevronRight aria-hidden size={16} /></Link></li>)}</ul>
        </section>
        <section style={{ order: 6 }} className="panel" aria-labelledby="featured-heading">
        <div className="panel-head"><h2 id="featured-heading">Start with these</h2></div>
        <ul className="rows">{featured.map(tool => { const Icon = TOOL_ICONS[tool.icon]; return <li key={tool.href}><Link prefetch={false} href={tool.href!} className="row-link tool-row"><Icon aria-hidden size={18} strokeWidth={1.75} /><span className="row-text">{tool.title}<small className="meta">{tool.formats.slice(0, 3).join(" · ")}</small></span><ChevronRight aria-hidden size={16} /></Link></li>; })}</ul>
      </section>
        <section style={{ order: 7 }} className="panel" aria-labelledby="formats-heading">
        <div className="panel-head"><h2 id="formats-heading">Supported formats</h2><Link prefetch={false} href="/supported-formats" className={buttonClass("secondary")}>Details</Link></div>
        <dl className="format-list">{FORMATS.map(([kind, input, output]) => <div key={kind}><dt>{kind}</dt><dd><span className="meta">{input}</span>{output && <span className="meta">→ {output}</span>}</dd></div>)}</dl>
      </section>
        <section style={{ order: 8 }} className="panel home-private" aria-labelledby="local-heading">
        <h2 id="local-heading"><ShieldCheck aria-hidden size={20} strokeWidth={1.75} />Why local processing matters</h2>
        <ul className="private-points">
          <li><strong>Your files stay with you.</strong> Media is read, processed and saved inside this tab. There is no upload step and no copy on a server.</li>
          <li><strong>No waiting in a queue.</strong> Work starts when you press the button, at the speed of your own device.</li>
          <li><strong>Real results.</strong> Every size, duration and dimension shown is measured from the actual output file.</li>
        </ul>
        <Link prefetch={false} href="/privacy" className={buttonClass("secondary", "md", "panel-action")}>Read the privacy notes</Link>
      </section>
      </div>
    </div>
  </main></SiteShell>;
}
