import { PHOTO_TOOLS } from "@/lib/images/tools";

export type ToolCategory = "ai" | "video" | "audio" | "photo";
export type ToolIcon =
  | "compress-image" | "resize-image" | "convert-image" | "heic" | "background" | "passport"
  | "compress-video" | "editor" | "trim" | "gif" | "mp4" | "mute"
  | "audio-convert" | "extract-audio" | "cut-audio" | "volume"
  | "subtitles" | "music-off" | "translate" | "dub" | "noise" | "ai-edit" | "vocal" | "transcribe" | "audio-video" | "tts" | "text-video" | "image-video";

/**
 * `available` tools work today and have a route. `planned` tools are on the roadmap only: they have no route,
 * no page and no controls, and the interface labels them "Not available yet". Never give a planned entry an href.
 */
export interface ToolEntry {
  title: string; navLabel: string; summary: string; category: ToolCategory; icon: ToolIcon; formats: string[];
  status: "available" | "planned"; href?: string; badge?: "AI"; transform?: [from: string, to: string]; note?: string;
}

const available = (entry: Omit<ToolEntry, "status">): ToolEntry => ({ ...entry, status: "available" });

export const TOOLS: ToolEntry[] = [
  available({ href: "/tools/pdf-to-audio", title: "PDF to Audio", navLabel: "PDF to Audio", summary: "Read a text-based PDF locally, select and edit an English passage, then generate downloadable WAV with optional SpeechT5 models. No OCR or upload.", category: "audio", icon: "tts", formats: ["PDF", "WAV"] }),
  available({ href: "/tools/lecture-to-notes", title: "Lecture to Notes", navLabel: "Lecture to Notes", summary: "Transcribe locally, review source times, and download extractive notes, key quotes and cloze study cards as TXT or Markdown.", category: "ai", icon: "transcribe", formats: ["MP3", "WAV", "MP4", "TXT", "MD"] }),
  // AI
  available({ href: "/studio", title: "Auto Subtitles", navLabel: "Auto Subtitles", summary: "Generate captions from speech with a speech model that runs in your browser, then style and export them in Reel Studio.", category: "ai", icon: "subtitles", badge: "AI", formats: ["MP4", "WebM"], note: "Opens in Reel Studio. The model is downloaded once when you choose it." }),
  available({ href:"/tools/remove-music", title:"Remove Music from Video", navLabel:"Remove Music", summary:"Reduce wide stereo music by keeping the centre channel. Stereo DSP, not AI separation; centred music can remain.", category:"audio", icon:"music-off", formats:["MP4","WebM"] }),
  available({ href:"/tools/video-translator", title:"Video Translator", navLabel:"Video Translator", summary:"Translate speech to English subtitles locally; additional languages use a supported browser's on-device language packs.", category:"ai", icon:"translate", badge:"AI", formats:["MP4","WebM","SRT","VTT"] }),
  available({ href:"/tools/ai-dubbing", title:"AI Dubbing", navLabel:"AI Dubbing", summary:"Make an English dubbed video with optional local Whisper/SpeechT5 downloads. Generic voice; no voice cloning or lip sync.", category:"ai", icon:"dub", badge:"AI", formats:["MP4","WebM"] }),
  available({ href:"/tools/noise-remover", title:"Noise Remover", navLabel:"Noise Remover", summary:"Clean speech locally with neural RNNoise or light noise-profile reduction. Preview and download WAV or cleaned video.", category:"audio", icon:"noise", formats:["WAV","MP3","M4A"] }),
  available({ href: "/studio", title: "Automatic Editing", navLabel: "Auto Editing", summary: "Detect silences, remove long pauses and gaps, and generate captions automatically in Reel Studio.", category: "ai", icon: "ai-edit", formats: ["MP4", "WebM"], note: "Opens in Reel Studio. Silence detection is rule-based, not a generative AI model." }),
  available({ href:"/tools/vocal-remover", title:"Vocal Remover", navLabel:"Vocal Remover", summary:"Split true stereo into centre and side WAV tracks. Centred vocals are reduced; this is not neural stem separation.", category:"audio", icon:"vocal", formats:["WAV","MP3","M4A"] }),
  available({ href:"/tools/transcribe-to-text", title:"Transcribe to Text", navLabel:"Transcribe", summary:"Generate editable TXT, SRT and VTT from short recordings with optional local Whisper models.", category:"ai", icon:"transcribe", badge:"AI", formats:["MP3","MP4","TXT","SRT"] }),
  available({ href:"/tools/text-to-video", title:"Text to Video", navLabel:"Text to Video", summary:"Render script cards into an MP4, with optional local English narration. No generated footage.", category:"video", icon:"text-video", formats:["MP4"] }),
  available({ href:"/tools/image-to-video", title:"Image to Video", navLabel:"Image to Video", summary:"Render a photo into a slow zoom animation with optional captions/narration. No generative subject motion.", category:"video", icon:"image-video", formats:["JPEG","PNG","WebP","MP4"] }),
  // Video
  available({ href: "/tools/shorts-maker", title: "Shorts Maker", navLabel: "Shorts Maker", summary: "Review speech-based moment suggestions, choose a range and crop, then export a separate Short through Reel Studio. Local Whisper; deterministic suggestions.", category: "video", icon: "trim", formats: ["MP4", "WebM"] }),
  available({ href: "/tools/video-compressor", title: "Video Compressor", navLabel: "Compress Video", summary: "Make a smaller video with resolution and quality presets, an optional size target in MB, and audio control.", category: "video", icon: "compress-video", formats: ["MP4", "MOV", "WebM"], transform: ["Large video", "Smaller MP4 or WebM"] }),
  available({ href: "/studio", title: "Reel Studio", navLabel: "Reel Studio", summary: "Edit a talking-head video on a timeline, add captions, remove silences and export a vertical reel.", category: "video", icon: "editor", formats: ["MP4", "WebM"] }),
  available({ href: "/tools/trim-video", title: "Trim Video", navLabel: "Trim Video", summary: "Cut a video to the part you need. Fast mode copies without re-encoding; Precise mode cuts at exact times.", category: "video", icon: "trim", formats: ["MP4", "MOV", "WebM", "MKV"] }),
  available({ href: "/tools/video-to-gif", title: "Video to GIF", navLabel: "Video to GIF", summary: "Turn a short clip into an animated GIF, choosing the range, frame rate, width and colours.", category: "video", icon: "gif", formats: ["MP4", "MOV", "WebM", "MKV"], transform: ["Video clip", "Animated GIF"] }),
  available({ href: "/tools/compress-video-to-size", title: "Compress Video to Size", navLabel: "Compress to Size", summary: "Fit a video under a size limit such as 10 MB or 25 MB. The bitrate is calculated from the target and the result is measured.", category: "video", icon: "compress-video", formats: ["MP4", "MOV", "WebM"] }),
  available({ href: "/tools/convert-to-mp4", title: "Convert to MP4", navLabel: "Convert to MP4", summary: "Turn MOV, WebM or MKV video into an MP4 that plays almost anywhere, without re-encoding H.264 sources.", category: "video", icon: "mp4", formats: ["MOV", "WebM", "MKV"], transform: ["MOV, WebM, MKV", "MP4"] }),
  available({ href: "/tools/remove-audio", title: "Remove Audio from Video", navLabel: "Remove Audio", summary: "Remove a video's audio track. The picture is copied without re-encoding, so quality is unchanged.", category: "video", icon: "mute", formats: ["MP4", "MOV", "WebM", "MKV"] }),
  // Audio
  available({ href: "/tools/audio-converter", title: "Audio Converter", navLabel: "Audio Converter", summary: "Convert MP3, WAV, M4A, Ogg, Opus or FLAC audio to M4A, WAV or Ogg in your browser.", category: "audio", icon: "audio-convert", formats: ["MP3", "WAV", "M4A", "Ogg", "FLAC"], transform: ["MP3, FLAC, WAV", "M4A, WAV, Ogg"] }),
  available({ href: "/tools/extract-audio", title: "Extract Audio from Video", navLabel: "Extract Audio", summary: "Save the soundtrack of a video as an M4A, WAV or Ogg audio file.", category: "audio", icon: "extract-audio", formats: ["MP4", "MOV", "WebM", "MKV"], transform: ["Video", "Audio file"] }),
  available({ href: "/tools/audio-cutter", title: "Audio Cutter", navLabel: "Audio Cutter", summary: "Trim audio to the part you need on a real waveform, with fade in and fade out.", category: "audio", icon: "cut-audio", formats: ["MP3", "WAV", "M4A", "Ogg", "FLAC"] }),
  available({ href: "/tools/increase-volume", title: "Increase Volume", navLabel: "Increase Volume", summary: "Make quiet audio louder with a gain control or peak normalization, without hard clipping.", category: "audio", icon: "volume", formats: ["MP3", "WAV", "M4A", "Ogg"] }),
  available({ href: "/tools/audio-to-video", title: "Audio to Video", navLabel: "Audio to Video", summary: "Turn an audio file into an MP4 with a background colour or image and a visualiser that follows the sound.", category: "audio", icon: "audio-video", formats: ["MP3", "WAV", "M4A", "Ogg"], transform: ["Audio", "MP4 video"] }),
  available({ href: "/tools/text-to-speech", title: "Text to Speech", navLabel: "Text to Speech", summary: "Generate English speech locally and download WAV, or listen with installed device voices. Optional speech model download.", category: "audio", icon: "tts", formats: ["TXT", "WAV"] }),
  // Photos
  available({ href: `/tools/${PHOTO_TOOLS.compressor.slug}`, title: PHOTO_TOOLS.compressor.title, navLabel: "Compress Image", summary: "Shrink JPG, PNG and WebP images while controlling quality, dimensions or a target file size.", category: "photo", icon: "compress-image", formats: ["JPEG", "PNG", "WebP"], transform: ["Image", "Smaller file"] }),
  available({ href: `/tools/${PHOTO_TOOLS.converter.slug}`, title: PHOTO_TOOLS.converter.title, navLabel: "Convert Image", summary: "Convert between JPEG, PNG and WebP, choosing a background when transparency can't be kept.", category: "photo", icon: "convert-image", formats: ["JPEG", "PNG", "WebP"], transform: ["PNG", "WebP or JPEG"] }),
  available({ href: `/tools/${PHOTO_TOOLS.resizer.slug}`, title: PHOTO_TOOLS.resizer.title, navLabel: "Resize Image", summary: "Set exact pixel dimensions or a percentage, with the aspect ratio locked or free.", category: "photo", icon: "resize-image", formats: ["JPEG", "PNG", "WebP"] }),
  available({ href: "/tools/heic-to-jpg", title: "HEIC to JPG Converter", navLabel: "HEIC to JPG", summary: "Convert iPhone HEIC and HEIF photos to JPG, one or many at a time, with rotation applied.", category: "photo", icon: "heic", formats: ["HEIC", "HEIF"], transform: ["HEIC", "JPG"] }),
  available({ href: "/tools/background-remover", title: "Background Remover", navLabel: "Remove Background", summary: "Cut the main subject out of a photo with an AI model that runs in your browser. Download a transparent PNG or WebP.", category: "photo", icon: "background", badge: "AI", formats: ["JPEG", "PNG", "WebP"], transform: ["Photo", "Transparent PNG"], note: "The model (about 19 MB with its runtime) downloads once, the first time you use it." }),
  available({ href: "/tools/passport-photo", title: "Passport Photo Maker", navLabel: "Passport Photo", summary: "Crop a portrait to a passport or ID photo size and download the photo plus a 6 × 4 in print sheet.", category: "photo", icon: "passport", formats: ["JPEG", "PNG", "WebP"], transform: ["Portrait", "35 × 45 mm photo"] }),
];

export const CATEGORIES: { id: ToolCategory; title: string; navTitle: string; blurb: string; local: boolean }[] = [
  { id: "ai", title: "AI tools", navTitle: "AI tools", blurb: "Speech and media models. Where each one runs is stated on the tool.", local: false },
  { id: "video", title: "Video", navTitle: "Video tools", blurb: "Encoded on your device with WebCodecs. Nothing is sent to a server.", local: true },
  { id: "audio", title: "Audio", navTitle: "Audio tools", blurb: "Decoded and encoded on your device. Nothing is sent to a server.", local: true },
  { id: "photo", title: "Photos", navTitle: "Photo tools", blurb: "Still images, encoded with your browser's own image codecs.", local: true },
];

export const toolsIn = (category: ToolCategory) => TOOLS.filter(tool => tool.category === category);
export const availableTools = TOOLS.filter(tool => tool.status === "available");
/** Standalone utility pages under /tools (excludes links into the Studio). */
export const utilityTools = availableTools.filter(tool => tool.href?.startsWith("/tools/"));
