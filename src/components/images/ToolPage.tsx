import type { Metadata } from "next";
import { siteOrigin } from "@/lib/site";
import type { ImageTool as Tool } from "@/lib/images/policy";
import { PHOTO_TOOLS } from "@/lib/images/tools";
import { ToolPageLayout } from "@/components/tools/ToolPageLayout";
import { ImageCompressor } from "./ImageCompressor";
import { ImageConverter } from "./ImageConverter";
import { ImageResizer } from "./ImageResizer";

const PHOTO_FAQS = [
  { question: "Are my images uploaded or stored?", answer: "No. Processing runs locally in this browser tab. These tools do not upload or persist your image files. Closing or reloading the tab clears the working image; download results you want to keep." },
  { question: "What are the image limits?", answer: "Choose one still JPEG, PNG or WebP up to 25 MiB, 8192 pixels per side and 16 megapixels total. Animated PNG/WebP, GIF, SVG, HEIC and RAW are not supported. A device with less memory may need smaller files." },
];

const PHOTO_INFO: Record<Tool, { title: string; paragraphs: string[] }> = {
  compressor: { title: "Which format should I choose?", paragraphs: [
    "WebP is usually the smallest choice for photos and keeps transparency. JPEG opens everywhere but cannot store transparency. PNG is lossless: ideal for screenshots and graphics with sharp edges, but rarely smaller than the original.",
    "If a target size is hard to reach, shrinking the dimensions usually saves far more than lowering quality further. Set “Maximum dimensions” under Advanced.",
  ] },
  resizer: { title: "Choosing dimensions", paragraphs: [
    "Resizing an image to the size it will actually be displayed at often saves more space than lowering its quality. Keep the aspect ratio locked to avoid stretching.",
    "Fit presets keep the whole image inside a square box, so a portrait photo fitted within 1080 × 1080 becomes 1080 pixels tall. Presets never enlarge a smaller image.",
  ] },
  converter: { title: "Converting images with transparency", paragraphs: [
    "PNG and WebP keep transparent areas. JPEG has no transparency, so transparent pixels are blended onto a background colour you choose before converting.",
    "Converting does not recover detail: a JPEG converted to PNG keeps its compression artefacts but becomes larger.",
  ] },
};

export function photoMetadata(tool: Tool): Metadata {
  const item = PHOTO_TOOLS[tool];
  return { title: `${item.title} · Reel Finisher`, description: item.description, ...(siteOrigin() ? { alternates: { canonical: `/tools/${item.slug}` } } : {}) };
}

export function ToolPage({ tool }: { tool: Tool }) {
  const item = PHOTO_TOOLS[tool];
  return <ToolPageLayout href={`/tools/${item.slug}`} category="photo" title={item.title} lead={item.description} stepsTitle={`How to use the ${item.title.toLowerCase()}`} steps={item.instructions} info={PHOTO_INFO[tool]} faqs={[...item.faqs, ...PHOTO_FAQS]}>
    {{ compressor: <ImageCompressor />, resizer: <ImageResizer />, converter: <ImageConverter /> }[tool]}
  </ToolPageLayout>;
}
