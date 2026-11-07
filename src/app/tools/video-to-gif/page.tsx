import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
import { ToolPageLayout } from "@/components/tools/ToolPageLayout";
import { GifMaker } from "@/components/media/GifMaker";

export const viewport = siteViewport;
export const metadata: Metadata = { title: "Video to GIF Converter · Reel Finisher", description: "Turn a clip from an MP4, MOV, WebM or MKV video into an animated GIF in your browser. Choose the range, frame rate, width and colours. No upload.", ...(siteOrigin() ? { alternates: { canonical: "/tools/video-to-gif" } } : {}) };

const STEPS = ["Choose or drop a video.", "Pick a clip of up to 15 seconds with the sliders, the second fields or the playhead buttons.", "Set the frame rate, width and number of colours.", "Create the GIF, preview it and download it."];
const INFO = { title: "Keeping GIFs small", paragraphs: [
  "GIF stores every frame as an image with at most 256 colours, so it is far larger than video. File size grows with width × height × frames: halving the width roughly quarters the size, and 12 fps instead of 20 saves about 40%.",
  "Each frame gets its own palette, which keeps colours accurate. Smooth gradients can still band; 256 colours reduces that at the cost of size. GIFs have no sound.",
] };
const FAQS = [
  { question: "Is my video uploaded?", answer: "No. Frames are decoded and encoded into a GIF by a worker in this browser tab." },
  { question: "What are the limits?", answer: "Clips up to 15 seconds and 300 frames, 120 to 640 pixels wide, from videos up to 512 MiB and 10 minutes. The GIF is capped at 40 MB to protect your device's memory." },
  { question: "Why is my GIF so large?", answer: "GIF compresses poorly. Use a smaller width, a lower frame rate, fewer colours or a shorter clip. For anything longer than a few seconds, an MP4 is usually a better choice." },
];

export default function Page() {
  return <ToolPageLayout href="/tools/video-to-gif" category="video" title="Video to GIF" lead="Turn a short clip from a video into an animated GIF." stepsTitle="How to make a GIF from a video" steps={STEPS} info={INFO} faqs={FAQS}>
    <GifMaker />
  </ToolPageLayout>;
}
