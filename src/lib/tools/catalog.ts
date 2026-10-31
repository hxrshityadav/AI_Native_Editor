import { PHOTO_TOOLS } from "@/lib/images/tools";

export type ToolCategory = "photo" | "video" | "audio";
export type ToolIcon = "compress-image" | "resize-image" | "convert-image" | "compress-video" | "editor";
export interface ToolEntry { href: string; title: string; summary: string; category: ToolCategory; icon: ToolIcon; formats: string[] }

/** Only tools that work today. Add an entry when a tool ships, never before. */
export const TOOLS: ToolEntry[] = [
  { href: `/tools/${PHOTO_TOOLS.compressor.slug}`, title: PHOTO_TOOLS.compressor.title, summary: "Shrink a photo with a quality ceiling or an optional target size, and see the measured result.", category: "photo", icon: "compress-image", formats: ["JPEG", "PNG", "WebP"] },
  { href: `/tools/${PHOTO_TOOLS.resizer.slug}`, title: PHOTO_TOOLS.resizer.title, summary: "Set exact pixel dimensions or fit inside a common size, with the aspect ratio locked or free.", category: "photo", icon: "resize-image", formats: ["JPEG", "PNG", "WebP"] },
  { href: `/tools/${PHOTO_TOOLS.converter.slug}`, title: PHOTO_TOOLS.converter.title, summary: "Convert between JPEG, PNG and WebP, choosing a background when transparency can't be kept.", category: "photo", icon: "convert-image", formats: ["JPEG", "PNG", "WebP"] },
  { href: "/tools/video-compressor", title: "Video Compressor", summary: "Make a smaller video with resolution and quality presets, an optional size target and audio control.", category: "video", icon: "compress-video", formats: ["MP4", "MOV", "WebM"] },
  { href: "/studio", title: "Reel Studio", summary: "Edit a talking-head video on a timeline, add captions, remove silences and export a vertical reel.", category: "video", icon: "editor", formats: ["MP4", "WebM"] },
];

export const CATEGORIES: { id: ToolCategory; title: string; blurb: string; empty?: string }[] = [
  { id: "photo", title: "Photo", blurb: "Still images, encoded with your browser's own image codecs." },
  { id: "video", title: "Video", blurb: "Encoded on your device with WebCodecs. Nothing is sent to a server." },
  { id: "audio", title: "Audio", blurb: "Standalone audio tools.", empty: "No standalone audio tools yet. For now, the Reel Studio trims clips and removes silences in your edit." },
];

export const toolsIn = (category: ToolCategory) => TOOLS.filter(tool => tool.category === category);
