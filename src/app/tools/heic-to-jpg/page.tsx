import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
import { Gauge, HardDrive, Layers, WifiOff } from "lucide-react";
import { ToolPageLayout, type Feature } from "@/components/tools/ToolPageLayout";
import { HeicConverter } from "@/components/images/HeicConverter";

export const viewport = siteViewport;
export const metadata: Metadata = { title: "HEIC to JPG Converter · Reel Finisher", description: "Convert iPhone HEIC and HEIF photos to JPG in your browser, one or many at a time, with rotation applied. No uploads and no account.", ...(siteOrigin() ? { alternates: { canonical: "/tools/heic-to-jpg" } } : {}) };

const STEPS = ["Choose or drop up to 20 HEIC or HEIF photos.", "Pick the JPEG quality: Standard suits most photos.", "Convert. Each photo is decoded and encoded in this browser tab, one after another.", "Download each JPG from the list. Your HEIC files are unchanged."];
const INFO = { title: "Why convert HEIC?", paragraphs: [
  "iPhones save photos as HEIC to keep them small, but many websites, Windows apps and older devices cannot open them. JPG opens almost everywhere.",
  "Chrome, Edge and Firefox cannot decode HEIC themselves, so this tool loads a decoder (libheif, compiled to WebAssembly) the first time you convert. Your photos are never uploaded.",
] };
const FAQS = [
  { question: "Are my photos uploaded?", answer: "No. Decoding and encoding run in this browser tab. The decoder is downloaded from this website once; your photos are not sent anywhere." },
  { question: "Does it keep the photo's rotation?", answer: "Yes. Rotation and mirroring stored in the HEIC file are applied to the JPG pixels, so the photo looks the same as on your phone." },
  { question: "Is location and camera information kept?", answer: "No. The JPG contains the picture only; EXIF metadata such as location, date and camera model is not copied." },
  { question: "What about Live Photos, bursts and depth?", answer: "Only the main still image is converted. Motion from Live Photos, depth maps and extra burst frames are not included; the tool tells you when a file held more than one image." },
  { question: "What are the limits?", answer: "Up to 20 photos at a time, each up to 25 MiB and 50 megapixels. Very large photos can run out of memory on phones; convert them on a computer if that happens." },
];

const FEATURES: Feature[] = [
  { icon: HardDrive, title: "Runs locally", text: "libheif decodes each photo in a worker in this tab." },
  { icon: WifiOff, title: "No uploads", text: "No server ever receives your photos." },
  { icon: Layers, title: "HEIC and HEIF in, JPG out", text: "Batches of up to 20 photos." },
  { icon: Gauge, title: "Rotation applied", text: "Photos look the same as on your phone." },
];

export default function Page() {
  return <ToolPageLayout href="/tools/heic-to-jpg" category="photo" title="HEIC to JPG Converter" lead="Convert iPhone HEIC photos to JPG in your browser, one or many at a time." stepsTitle="How to convert HEIC to JPG" steps={STEPS} info={INFO} faqs={FAQS} features={FEATURES}>
    <HeicConverter />
  </ToolPageLayout>;
}
