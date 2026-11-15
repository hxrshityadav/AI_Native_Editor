import type { Metadata } from "next";
import { AudioLines, Film, HardDrive, WifiOff } from "lucide-react";
import { siteOrigin, siteViewport } from "@/lib/site";
import { ToolPageLayout, type Feature } from "@/components/tools/ToolPageLayout";
import { MusicMixer } from "@/components/media/MusicMixer";

export const viewport = siteViewport;
export const metadata: Metadata = { title: "Add Background Music with Auto Ducking · Reel Finisher", description: "Mix background music under a voice-over or a video's own audio. The music dips automatically while someone speaks. Levels, fades, start point and looping, all in your browser.", ...(siteOrigin() ? { alternates: { canonical: "/tools/music-mixer" } } : {}) };

const FEATURES: Feature[] = [
  { icon: HardDrive, title: "Runs locally", text: "Decoded, mixed and encoded by a worker in this tab." },
  { icon: WifiOff, title: "No uploads", text: "No server receives your voice, video or music." },
  { icon: AudioLines, title: "Real ducking", text: "The music follows the speech it measures, not a fixed level." },
  { icon: Film, title: "Video stays sharp", text: "For video, the picture is copied without re-encoding." },
];
const STEPS = ["Choose a voice recording or a video with speech, up to 10 minutes.", "Add a music file and set the voice and music levels.", "Keep automatic ducking on, or switch it off for a constant music level. Set fades, the music start and looping.", "Mix, preview the result and download it."];
const INFO = { title: "How the automatic ducking works", paragraphs: [
  "Before mixing, the voice is decoded and its loudness is measured every 20 milliseconds. The quietest tenth of the recording sets the noise floor; anything clearly above it counts as speech, with a short lead-in and hold so words are not clipped.",
  "The music level then follows that speech map: it dips by the chosen depth over about 60 milliseconds when speech starts, and recovers over about 400 milliseconds after it stops. A soft limiter keeps the combined signal from hard clipping.",
  "Music and voice are both converted to 48 kHz stereo. For a video, only the audio track is rewritten, so the picture keeps its original quality.",
] };
const FAQS = [
  { question: "Are my files uploaded?", answer: "No. The voice, the video and the music are read, mixed and encoded in this browser tab. Nothing is sent to a server." },
  { question: "Is this AI?", answer: "No. The ducking is signal measurement: it follows the voice's loudness. It works best on clear speech; constant loud background noise in the voice recording makes speech harder to tell apart." },
  { question: "Why is there no MP3 output?", answer: "Browsers do not include an MP3 encoder, and Reel Finisher does not ship one. MP3 music files can be used as input. Audio-only mixes are saved as M4A or WAV; videos keep their own container." },
  { question: "What are the limits?", answer: "Up to 10 minutes and 512 MiB per file. The voice or video must have an audio track. AAC and Opus encoding needs a current Chrome or Edge; WAV output works everywhere." },
];

export default function Page() {
  return <ToolPageLayout href="/tools/music-mixer" category="audio" title="Music Mixer" lead="Add background music under a voice-over or video. The music dips automatically while someone speaks." stepsTitle="How to add background music" steps={STEPS} info={INFO} faqs={FAQS} features={FEATURES}>
    <MusicMixer />
  </ToolPageLayout>;
}
