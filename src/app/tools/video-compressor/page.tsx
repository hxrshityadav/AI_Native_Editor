import type { Metadata } from "next";
import { siteOrigin } from "@/lib/site";
import { ToolFrame } from "@/components/images/ToolPage";
import { VideoCompressor } from "@/components/videos/VideoCompressor";
export const metadata: Metadata = { title: "Video Compressor · Reel Finisher", description: "Compress video locally in your browser. Choose resolution, quality and an optional file-size target, preserve audio or mute, then preview and download a measured result.", ...(siteOrigin() ? { alternates: { canonical: "/tools/video-compressor" } } : {}) };
const STEPS = ["Choose or drop one MP4, MOV or WebM. Check its picture, sound, orientation and original size.", "Choose a resolution and quality. Presets never upscale. Optionally enter a target in decimal KB or MB; the estimate is not a measured result.", "Compress locally, compare both previews, check the measured size and sound, then download a new file. Cancel or choose another file at any time."];
const FAQS = [
  ["Does my video leave this device?", "No. A dedicated browser worker reads the local file and encodes it on-device. This tool has no upload endpoint, remote encoder, paid AI service or account requirement."],
  ["Which output formats work?", "The tool checks the actual browser encoders for H.264/AAC in MP4 and VP9/Opus in WebM at the chosen dimensions. Automatic mode prefers supported MP4, then WebM. If audio cannot be preserved, choose another format/browser or explicitly mute; it is never silently removed."],
  ["Will it reach an exact file size?", "No exact size is guaranteed. The estimate uses bitrate, duration and an overhead allowance. A target lowers the requested bitrate; the final Blob is measured. If it exceeds the target, the tool says so and suggests lower resolution or quality. Already-compressed inputs can become larger."],
  ["What are the limits and memory requirements?", "Input is limited to 512 MiB, 10 minutes, 3840 pixels on the longest edge and 8.3 megapixels. Encoded output is capped at 128 MiB. Frames are streamed, not decoded as one whole movie. Encoded-byte pages and their final Blob can briefly use roughly twice the output size, plus decoder, encoder and preview memory. Low-memory devices may require much smaller videos."],
  ["What happens to orientation, frame rate and metadata?", "Rotation is baked into the pixels and the whole picture is contained at the chosen aspect ratio. Chroma-compatible dimensions round down to even pixels. Output is constant frame rate, capped at 30 fps; variable-frame-rate timing is normalized. Camera/location tags, subtitle/data tracks and extra streams are not retained. Only a single video and at most one audio track are accepted. Audio is encoded to stereo 48 kHz when retained. HDR colours may change; prefer SDR sources."],
  ["Why can compression fail on my browser?", "Codec APIs, hardware encoders, memory and browser restrictions vary. An encoder probe is not a guarantee for every frame. Unsupported sources, stalled encoders and invalid outputs show recovery errors. Try 720p or 480p, lower bitrate or another current browser. No server fallback or FFmpeg runtime is used."],
].map(([question, answer]) => ({ question, answer }));
const INFO = { title: "Choosing resolution and quality", paragraphs: [
  "Resolution has the largest effect on file size. 720p is usually enough for messaging apps and phone screens; keep 1080p when people will watch on large displays. Presets never enlarge a smaller video.",
  "Quality presets set the bitrate for the chosen resolution. A target size lowers the bitrate further, but the encoder decides the final size, so the result is measured and reported rather than promised.",
] };
export default function Page() {
  return <ToolFrame category="video" title="Video Compressor" lead="Make a smaller video on your own device. Compare the original and measured result before downloading, with no account or upload." stepsTitle="How to compress a video" steps={STEPS} info={INFO} faqs={FAQS}>
    <VideoCompressor />
  </ToolFrame>;
}
