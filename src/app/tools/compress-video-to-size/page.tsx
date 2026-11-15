import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
import { ToolPageLayout } from "@/components/tools/ToolPageLayout";
import { VideoCompressor } from "@/components/videos/VideoCompressor";

export const viewport = siteViewport;
export const metadata: Metadata = { title: "Compress Video to a Target Size · Reel Finisher", description: "Compress a video to fit a size limit such as 10 MB or 25 MB. The bitrate is calculated from the length and target, and the final size is measured. Runs in your browser.", ...(siteOrigin() ? { alternates: { canonical: "/tools/compress-video-to-size" } } : {}) };

const STEPS = ["Choose or drop an MP4, MOV or WebM video.", "Enter the size you need, or pick 8, 10, 25 or 50 MB.", "Check the requested bitrate, then compress.", "The result is measured: the tool says whether it fits the target before you download."];
const INFO = { title: "How the target is reached", paragraphs: [
  "File size is roughly bitrate × duration. The tool subtracts the audio bitrate and a small allowance for the container, then asks the encoder for the video bitrate that fits your target.",
  "Browser encoders do not hit a requested bitrate exactly, especially on very short or very static clips, so the final file is measured. If it is over the target, lower the resolution, mute the audio or choose a slightly smaller target.",
] };
const FAQS = [
  { question: "Will the video be exactly the size I enter?", answer: "Not exactly. The bitrate is calculated to fit, and the result is usually close, but encoders vary. The tool measures the output and tells you whether it met the target." },
  { question: "Is my video uploaded?", answer: "No. The video is encoded on your device by your browser's WebCodecs encoders in a worker." },
  { question: "What if the target is too small?", answer: "Below a minimum bitrate the picture breaks down. The tool warns you before compressing; lowering the resolution or muting the audio helps." },
];

export default function Page() {
  return <ToolPageLayout href="/tools/compress-video-to-size" category="video" title="Compress Video to Size" lead="Shrink a video to fit an upload limit such as 10 MB or 25 MB." stepsTitle="How to compress a video to a size" steps={STEPS} info={INFO} faqs={FAQS}>
    <VideoCompressor variant="size" />
  </ToolPageLayout>;
}
