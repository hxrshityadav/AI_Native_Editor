import { Aperture, AudioLines, AudioWaveform, Captions, Clapperboard, Eraser, FileAudio, FileImage, FileText, FileVideo, Film, IdCard, ImagePlay, Languages, Mic, MicVocal, Minimize2, Music2, Scaling, Scissors, Speech, Video, Volume2, VolumeX, WandSparkles, type LucideIcon } from "lucide-react";
import type { ToolIcon } from "@/lib/tools/catalog";

/** One icon per tool, shared by the sidebar, cards and tool headers so a tool looks the same everywhere. */
export const TOOL_ICONS: Record<ToolIcon, LucideIcon> = {
  "compress-image": Minimize2, "resize-image": Scaling, "convert-image": FileImage, heic: Aperture, background: Eraser, passport: IdCard,
  "compress-video": Film, editor: Clapperboard, trim: Scissors, gif: ImagePlay, mp4: FileVideo, mute: VolumeX,
  "audio-convert": FileAudio, "extract-audio": AudioLines, "cut-audio": AudioWaveform, volume: Volume2,
  subtitles: Captions, "music-off": Music2, translate: Languages, dub: Mic, noise: AudioWaveform, "ai-edit": WandSparkles, vocal: MicVocal,
  transcribe: FileText, "audio-video": Video, tts: Speech, "text-video": Clapperboard, "image-video": ImagePlay,
};
