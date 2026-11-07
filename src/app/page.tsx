import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { siteOrigin, siteViewport } from "@/lib/site";
import { TOOLS } from "@/lib/tools/catalog";
import { commandTools } from "@/lib/command-center/catalog";
import { SiteShell } from "@/components/site/SiteShell";
import { FinishingBench } from "@/components/site/FinishingBench";
import { WorkflowShowcase } from "@/components/site/WorkflowShowcase";
import { CommandPreview } from "@/components/site/home/CommandPreview";
import { HomeMotion } from "@/components/site/home/HomeMotion";
import { buttonClass } from "@/components/site/ui";
import "@/components/site/home/home.css";

export const viewport = siteViewport;
export const metadata: Metadata = { title: "Reel Finisher · Your creative workspace, in the browser", description: "Free photo, video and audio tools with local browser processing. Compress, convert, edit and create without a mandatory account or a watermark.", ...(siteOrigin() ? { alternates: { canonical: "/" } } : {}) };

const FEATURED = ["/tools/image-compressor", "/tools/video-compressor", "/tools/audio-cutter", "/tools/noise-remover", "/tools/text-to-speech"];

/** Sizes from docs/local-models.md; each model downloads only after the visitor agrees. */
const MODELS = [
  { name: "Whisper Tiny", job: "Speech to text, English translation, Shorts moments, lecture notes", size: "91 MiB", tool: "/tools/transcribe-to-text" },
  { name: "SpeechT5 + HiFi-GAN", job: "English speech from text, PDFs and dubbing", size: "370 MiB", tool: "/tools/text-to-speech" },
  { name: "U²-Net-p", job: "Subject cutout with a transparent background", size: "19 MB with runtime", tool: "/tools/background-remover" },
  { name: "RNNoise", job: "Neural speech cleanup", size: "124 KB", tool: "/tools/noise-remover" },
];

const STEPS = [
  { title: "Choose a file", text: "Drop it on the tool. Each tool checks the format, length and what your browser can encode before anything starts." },
  { title: "Set it up and run", text: "Pick a preset or set exact values. Progress comes from the real pipeline, and you can cancel at any point." },
  { title: "Check it, then download", text: "Compare the result with the original and read the measured size. Free downloads never carry a watermark." },
];

const FAQ = [
  { q: "Are my files uploaded?", a: "No. The photo, video, audio and AI tools process your file in this browser tab. If a feature ever needs a server, it says where the data goes before anything is sent." },
  { q: "What does it cost?", a: "The tools are free to use without an account, and exports carry no watermark." },
  { q: "Why do some AI tools ask to download a model?", a: "The model has to be on your device to run there. It downloads once, after you agree, and is cached in this browser. Your media and text are never sent with the download." },
  { q: "How long can a video be?", a: "Up to ten minutes. Some tools set a lower limit, and each one states its limit before you choose a file." },
  { q: "Which browser should I use?", a: "A current desktop Chrome or Edge supports every tool. Other browsers work for many tools; each tool checks the codecs your browser has and tells you before it starts if something is missing." },
  { q: "What is the difference between the tools and Reel Studio?", a: "A tool does one job on one file. Reel Studio is a timeline editor for talking-head reels: cuts, captions, silence removal and a vertical export." },
];

const Line = ({ children }: { children: string }) => <span className="hero-line"><span>{children}</span></span>;

export default function Home() {
  const featured = FEATURED.map(href => TOOLS.find(tool => tool.href === href)).filter(tool => !!tool);
  return <SiteShell><main className="home-page public-page">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="hero-copy">
        <h1 id="home-title"><Line>Finish your media.</Line> <Line>Skip the overhead.</Line></h1>
        <div className="hero-side">
          <p className="hero-lead">A creative workspace of {commandTools.length} photo, video and audio tools that run in your browser. Compress, convert, edit and create, and your files stay on your device.</p>
          <div className="hero-actions">
            <Link prefetch={false} href="/tools" className={buttonClass("primary", "lg")}>Explore tools<ArrowRight aria-hidden size={18} /></Link>
            <Link prefetch={false} href="/command-center" className={buttonClass("secondary", "lg")}>Open Command Center</Link>
          </div>
        </div>
      </div>
      <FinishingBench />
    </section>

    <section className="home-command" aria-labelledby="command-heading" data-reveal>
      <div className="home-command-copy">
        <h2 id="command-heading" data-reveal-part>Every tool, one keystroke away.</h2>
        <p data-reveal-part>The Command Center finds tools by name or format, keeps the ones you pin, and remembers which tools you opened. It stores routes only, in this browser, and you can clear it at any time.</p>
        <ul data-reveal-part className="home-command-facts"><li>Press Ctrl K (⌘ K on a Mac) on any page.</li><li>Pin favorites without an account.</li><li>No file names, results or transcripts are recorded.</li></ul>
        <Link data-reveal-part prefetch={false} href="/command-center" className={buttonClass("secondary")}>Open Command Center<ArrowUpRight aria-hidden size={17} /></Link>
      </div>
      <div data-reveal-part><CommandPreview /></div>
    </section>

    <section className="home-featured" aria-labelledby="featured-heading" data-reveal>
      <div className="section-heading" data-reveal-part><h2 id="featured-heading">The tools people reach for first</h2><Link prefetch={false} href="/tools">All {commandTools.length} tools <ArrowUpRight aria-hidden size={16} /></Link></div>
      <ol className="featured-list">{featured.map(tool => <li key={tool.href} data-reveal-part><Link prefetch={false} href={tool.href!}>
        <strong>{tool.title}</strong><span>{tool.summary}</span><small>{tool.formats.slice(0, 4).join(" · ")}</small><ArrowRight aria-hidden size={22} />
      </Link></li>)}</ol>
    </section>

    <section className="home-discovery" aria-labelledby="choose-tool" data-reveal>
      <div className="section-heading" data-reveal-part><h2 id="choose-tool">Photo, video, audio and AI</h2><Link prefetch={false} href="/tools">Browse by category <ArrowUpRight aria-hidden size={16} /></Link></div>
      <div data-reveal-part><WorkflowShowcase /></div>
    </section>

    <section className="home-models" aria-labelledby="models-heading" data-reveal>
      <div className="home-models-copy"><h2 id="models-heading" data-reveal-part>AI that runs on your device.</h2><p data-reveal-part>The AI tools use open models in this browser. Each one tells you its download size and asks first. After that it works from the cache, and nothing you give it leaves the tab.</p></div>
      <div className="models-table" data-reveal-part><table>
        <caption className="sr-only">Local AI models, what they do and their download size</caption>
        <thead><tr><th scope="col">Model</th><th scope="col">What it does</th><th scope="col">Download</th></tr></thead>
        <tbody>{MODELS.map(model => <tr key={model.name}><th scope="row"><Link prefetch={false} href={model.tool}>{model.name}</Link></th><td>{model.job}</td><td className="tabular">{model.size}</td></tr>)}</tbody>
      </table></div>
    </section>

    <section className="home-workflow" aria-labelledby="workflow-heading" data-reveal>
      <h2 id="workflow-heading" data-reveal-part>From a long recording to a finished Short.</h2>
      <ol className="workflow-steps">
        <li data-reveal-part><Link prefetch={false} href="/tools/noise-remover"><strong>Clean the sound</strong><span>Noise Remover runs RNNoise or a light noise profile on the speech.</span></Link></li>
        <li data-reveal-part><Link prefetch={false} href="/tools/shorts-maker"><strong>Find the moment</strong><span>Shorts Maker transcribes locally and suggests ranges from what was said.</span></Link></li>
        <li data-reveal-part><Link prefetch={false} href="/studio"><strong>Caption and export</strong><span>Reel Studio opens the range on a timeline for word captions and a vertical export.</span></Link></li>
      </ol>
    </section>

    <section className="home-private" aria-labelledby="local-heading" data-reveal>
      <h2 id="local-heading" data-reveal-part>Your files stay yours.</h2>
      <div className="home-private-body" data-reveal-part>
        <p>Local tools read, process and save your media inside this browser tab. There is no upload step, no queue and no copy on a server. Optional model downloads carry no media or text.</p>
        <Link prefetch={false} href="/privacy">Read the privacy notes <ArrowUpRight aria-hidden size={16} /></Link>
      </div>
    </section>

    <section className="home-how" aria-labelledby="how-heading" data-reveal>
      <h2 id="how-heading" data-reveal-part>How it works</h2>
      <ol>{STEPS.map(step => <li key={step.title} data-reveal-part><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
    </section>

    <section className="home-faq" aria-labelledby="faq-heading" data-reveal>
      <h2 id="faq-heading" data-reveal-part>Questions</h2>
      <div data-reveal-part>{FAQ.map(item => <details key={item.q}><summary>{item.q}<Plus aria-hidden size={18} /></summary><p>{item.a}</p></details>)}</div>
    </section>

    <section className="home-final" aria-labelledby="final-heading">
      <h2 id="final-heading"><span className="hero-line"><span>Pick a tool.</span></span> <span className="hero-line"><span>Bring your file.</span></span></h2>
      <div className="hero-actions"><Link prefetch={false} href="/tools" className={buttonClass("primary", "lg")}>Explore tools<ArrowRight aria-hidden size={18} /></Link><Link prefetch={false} href="/studio" className={buttonClass("secondary", "lg")}>Open Reel Studio</Link></div>
    </section>
    <HomeMotion />
  </main></SiteShell>;
}
