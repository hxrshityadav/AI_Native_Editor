import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";
import { photoToolPaths } from "@/lib/images/tools";
const newToolPaths=["noise-remover","vocal-remover","remove-music","transcribe-to-text","video-translator","ai-dubbing","text-to-video","image-to-video","shorts-maker","lecture-to-notes","pdf-to-audio"].map(slug=>`/tools/${slug}`);

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return origin ? ["/", "/privacy", "/supported-formats", "/tools", ...photoToolPaths, "/tools/video-compressor", "/tools/passport-photo", "/tools/heic-to-jpg", "/tools/background-remover", "/tools/trim-video", "/tools/remove-audio", "/tools/convert-to-mp4", "/tools/extract-audio", "/tools/audio-converter", "/tools/audio-cutter", "/tools/increase-volume", "/tools/video-to-gif", "/tools/compress-video-to-size", "/tools/audio-to-video", "/tools/text-to-speech",...newToolPaths].map((path) => ({ url: `${origin}${path}` })) : [];
}
