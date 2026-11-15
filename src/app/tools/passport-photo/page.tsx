import type { Metadata } from "next";
import { siteOrigin, siteViewport } from "@/lib/site";
import { ToolPageLayout } from "@/components/tools/ToolPageLayout";
import { PassportPhoto } from "@/components/images/PassportPhoto";

export const viewport = siteViewport;
export const metadata: Metadata = { title: "Passport Photo Maker · Reel Finisher", description: "Crop a portrait to a passport or ID photo size such as 35 × 45 mm or 2 × 2 in, choose a background fill, and download the photo and a 6 × 4 in print sheet. Runs in your browser.", ...(siteOrigin() ? { alternates: { canonical: "/tools/passport-photo" } } : {}) };

const STEPS = ["Choose or drop a recent portrait taken against a plain background.", "Pick the printed size you need, such as 35 × 45 mm or 2 × 2 in.", "Drag and zoom so your head sits inside the dashed guide, then choose a fill colour for any empty area.", "Create the photo and download it, or download a 6 × 4 in sheet to print at a photo shop."];
const INFO = { title: "About photo sizes and rules", paragraphs: [
  "This tool sets the printed size and framing at 300 DPI. Official rules on head size, eye level, expression, glasses, background colour and how recent the photo must be vary by country and document, and they change. Check your issuing authority's current requirements before you submit.",
  "The background fill only covers areas the photo does not reach. It does not replace the background behind you, so take the photo against a plain, evenly lit wall.",
] };
const FAQS = [
  { question: "Does this guarantee my photo will be accepted?", answer: "No. The tool produces the correct printed size; it does not check head size, expression, lighting or background. Requirements differ by authority, so compare the result with the official rules." },
  { question: "How do I print the photo?", answer: "Download the 6 × 4 in print sheet and print it at a photo shop or on photo paper at actual size (100%, no scaling). Cut along the grey guides." },
  { question: "Is my photo uploaded?", answer: "No. Cropping, resizing and encoding run in this browser tab. Close or reload the tab to clear the photo; download what you want to keep." },
  { question: "Can it remove or change the background?", answer: "Not yet. The fill colour only covers empty areas when you zoom out or move the photo. Background removal is planned as a separate tool." },
];

export default function Page() {
  return <ToolPageLayout href="/tools/passport-photo" category="photo" title="Passport Photo Maker" lead="Crop a portrait to a passport or ID photo size, then download the photo and a printable 6 × 4 in sheet." stepsTitle="How to make a passport photo" steps={STEPS} info={INFO} faqs={FAQS}>
    <PassportPhoto />
  </ToolPageLayout>;
}
