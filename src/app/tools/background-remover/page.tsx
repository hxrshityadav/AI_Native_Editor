import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
import { Gauge, HardDrive, Layers, WifiOff } from "lucide-react";
import { ToolPageLayout, type Feature } from "@/components/tools/ToolPageLayout";
import { BackgroundRemover } from "@/components/images/BackgroundRemover";

export const viewport = siteViewport;
export const metadata: Metadata = { title: "Background Remover · Reel Finisher", description: "Remove the background from a photo in your browser with an on-device AI model. Download a transparent PNG or WebP, or place the subject on a colour. No uploads.", ...(siteOrigin() ? { alternates: { canonical: "/tools/background-remover" } } : {}) };

const STEPS = ["Choose or drop a photo with one clear subject.", "Keep the background transparent, or choose white or another colour.", "Remove the background. The model runs in this tab; the first run downloads it once.", "Compare the original and the cut-out, then download a PNG or WebP."];
const INFO = { title: "How the background is removed", paragraphs: [
  "A salient object detection model (U²-Net-p, Apache-2.0) predicts which pixels belong to the most prominent subject. That prediction becomes the transparency of the full-resolution photo, so your original pixels are kept where the subject is.",
  "It is a small model chosen so it can run on ordinary laptops and phones. Clear subjects on contrasting backgrounds work best. Hair, fur, glass and fine edges come out soft, and busy scenes may keep or remove the wrong areas, so check the result before using it.",
] };
const FAQS = [
  { question: "Is my photo uploaded to an AI service?", answer: "No. The model and its runtime are downloaded from this website and run in your browser tab. Your photo never leaves your device." },
  { question: "Why does the first run take longer?", answer: "The first time, the browser downloads the model (4.6 MB) and the ONNX Runtime WebAssembly engine (about 14 MB). Later runs reuse them from the browser cache." },
  { question: "Which formats keep transparency?", answer: "PNG and WebP both keep the transparent background. When you choose a background colour, the result is saved as PNG." },
  { question: "What are the limits?", answer: "One JPEG, PNG or WebP image up to 25 MiB and 16 megapixels. Large photos need more memory; if your device runs out, try a smaller copy." },
];

const FEATURES: Feature[] = [
  { icon: HardDrive, title: "AI model runs in your browser", text: "U²-Net-p on ONNX Runtime, in a worker." },
  { icon: WifiOff, title: "No uploads", text: "The model comes to your photo, not the other way round." },
  { icon: Layers, title: "Transparent PNG or WebP", text: "Or place the subject on a colour." },
  { icon: Gauge, title: "Full resolution", text: "The mask is applied to your original pixels." },
];

export default function Page() {
  return <ToolPageLayout href="/tools/background-remover" category="photo" title="Background Remover" lead="Remove the background from a photo with an AI model that runs in your browser, then download a transparent PNG or WebP." stepsTitle="How to remove a background" steps={STEPS} info={INFO} faqs={FAQS} features={FEATURES}>
    <BackgroundRemover />
  </ToolPageLayout>;
}
