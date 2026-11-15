import type { Metadata } from "next";
import { Captions, Film, HardDrive, ListChecks } from "lucide-react";
import { siteOrigin, siteViewport } from "@/lib/site";
import { ToolPageLayout, type Feature } from "@/components/tools/ToolPageLayout";
import { SubtitleStudio } from "@/components/media/SubtitleStudio";

export const viewport = siteViewport;
export const metadata: Metadata = { title: "Subtitle Studio: Captions for Video, SRT and VTT · Reel Finisher", description: "Caption English, Hindi and Hinglish videos on your device: real word timing, fifteen styles, your own fonts, 9:16 to 16:9 frames, and SRT, VTT or burned-in MP4 export.", ...(siteOrigin() ? { alternates: { canonical: "/tools/subtitle-studio" } } : {}) };

const FEATURES: Feature[] = [
  { icon: HardDrive, title: "Stays on your device", text: "Transcription and export run in this tab. The video is never uploaded." },
  { icon: ListChecks, title: "Real word timing", text: "Word-by-word highlighting uses the model's own word timestamps." },
  { icon: Captions, title: "Fifteen caption styles", text: "Plus your own fonts, Latin and Devanagari, inside safe areas." },
  { icon: Film, title: "Preview equals export", text: "The preview is drawn by the same renderer as the MP4, at the same size." },
];
const STEPS = ["Choose a video up to 10 minutes.", "Pick the spoken language (auto, English, Hindi or Hinglish) and a model, agree to its one-time download, and transcribe on your device. Or write captions by hand.", "Review each caption: fix words, adjust times, split or merge, and use the rule-based clean-up tools.", "Choose a style, then set the frame: 9:16, 4:3, 16:9 or 1:1, and drag the captions where you want them.", "Download SRT or VTT, or export an MP4 with the captions burned in."];
const INFO = { title: "How Subtitle Studio works", paragraphs: [
  "Speech recognition runs Whisper Tiny (about 95 MiB) or, if you choose it, Whisper Base (about 140 MiB) in this browser. Both are exported with the attention data that gives each word its own start and end time, so word highlighting follows the recognised timing rather than an even split of the sentence.",
  "Auto detect really identifies the language first; it no longer defaults to English. Hindi mode transcribes in Devanagari and never translates. Hinglish uses the Hindi setting and can rewrite the result in Roman letters, or keep Devanagari and put common English words back in Latin letters. Those conversions are rule-based, and the recognised original is kept.",
  "Captions are drawn with bundled open-licence fonts or a font you upload. Poppins, Mukta, Hind and Baloo 2 include Devanagari. If a caption needs letters a font lacks, the studio says so instead of switching fonts silently.",
  "The burned-in MP4 is H.264 at the frame you choose, with the captions drawn by the same code as the preview. Audio is kept, or converted to AAC when needed.",
] };
const FAQS = [
  { question: "Is my video uploaded?", answer: "No. The audio is transcribed and the video is encoded in this browser tab. The only downloads are the speech model you choose, once, after you agree; they come from this website and are cached by your browser." },
  { question: "How accurate is Hindi and Hinglish?", answer: "It depends on the model and the recording, and it has not yet been measured on real Hindi speech for this tool, so check every caption. Earlier versions could turn Hindi into English because the speech engine assumed English when no language was set; Auto detect and the Hindi and Hinglish modes now set the language explicitly." },
  { question: "When are words highlighted one by one?", answer: "When the captions come from transcription, each word has its own recognised time. Captions you type or edit so that their word count changes show as whole captions, because there is no real timing for those words." },
  { question: "Can I use my own font?", answer: "Yes. Upload a TTF, OTF, WOFF or WOFF2 file. It stays in this browser, is checked for Latin and Devanagari letters, and is used for both the preview and the export. You are responsible for having the right to use it." },
  { question: "What are the limits?", answer: "Videos up to 10 minutes, 512 MiB and 4K. Exported MP4s are capped at 128 MiB; choose a smaller export size for long videos. Burning in captions needs an H.264 encoder, which current Chrome and Edge have." },
];

export default function Page() {
  return <ToolPageLayout href="/tools/subtitle-studio" category="video" title="Subtitle Studio" lead="Accurate-timed captions for English, Hindi and Hinglish videos: transcribe, edit, style and burn in, all on your device." stepsTitle="How to caption a video" steps={STEPS} info={INFO} faqs={FAQS} features={FEATURES}>
    <SubtitleStudio />
  </ToolPageLayout>;
}
