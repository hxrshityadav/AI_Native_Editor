import type { Project, MediaItem, Track } from "@openreel/core";
const DEFAULT_TRANSFORM = { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, anchor: { x: 0.5, y: 0.5 }, opacity: 1 };
import { videoSegments, captionsFromLines } from "../../../../../../src/lib/editor/operations";
import { normalizeCuts, sourceToEdited, remapCaptionLines, retainedPieces } from "../../../../../../src/lib/editor/timeline";
import { groupWords, DEFAULT_GROUP_OPTIONS } from "../../../../../../src/lib/captions/group";
import { getCaptionStyle } from "../../../../../../src/lib/captions/styles";
import { planComposition, compositionRect } from "../../../../../../src/lib/media/composition";
import { type BrandKit } from "../../../../../../src/lib/brandKit";
import { FONT_CATALOG, type FontRecord } from "../../../../../../src/lib/editor/fontLibrary";
import { captionTrack, makeCaption } from "./caption-project";
import { estimatedWords } from "./caption-data";

import type { EditingSettings } from "../../../../../../src/lib/editor/project";
export function migrationProblems(settings: EditingSettings, duration: number): string[] {
  const issues: string[] = [];
  const outputEnd = sourceToEdited(duration, settings.cuts);
  const last = videoSegments(settings, duration).at(-1);
  if (!last) issues.push("The legacy project has no remaining video.");
  if (last && last.outputEnd < outputEnd - 0.001) issues.push("The project ends with an empty gap. Close the trailing gap in the legacy editor before migration.");
  if (settings.segmentation !== "off") issues.push("Subject segmentation is not supported by this migration.");
  return issues;
}
export function convertLegacy(settings: EditingSettings, words: { text: string; start: number; end: number }[], media: MediaItem, fonts: FontRecord[] = FONT_CATALOG, kit: BrandKit | null = null): Project {
  const duration = media.metadata.duration;
  const cuts = normalizeCuts(settings.cuts, duration);
  const frame = planComposition(media.metadata, settings.exportPreset, settings.framing, settings.composition);
  const rect = compositionRect(media.metadata.width, media.metadata.height, frame);
  const baseFit = frame.fit === "cover" ? Math.max : Math.min;
  const baseScale = baseFit(frame.width / media.metadata.width, frame.height / media.metadata.height);
  const zoom = rect.width / (media.metadata.width * baseScale);
  const videoTrack: Track = { ...captionTrack("Original video"), type: "video", role: "general", clips: videoSegments(settings, duration).map((piece) => ({
    id: crypto.randomUUID(), trackId: "legacy-video", mediaId: media.id, startTime: piece.outputStart, duration: piece.outputEnd - piece.outputStart, inPoint: piece.start, outPoint: piece.end,
    effects: [], audioEffects: [], volume: settings.audio.muted ? 0 : settings.audio.volume, keyframes: [],
    transform: { ...DEFAULT_TRANSFORM, fitMode: frame.fit === "cover" ? "cover" : "contain", scale: { x: zoom, y: zoom }, position: { x: rect.x + rect.width / 2 - frame.width / 2, y: rect.y + rect.height / 2 - frame.height / 2 } } })), id: "legacy-video" };
  const project: Project = { id: crypto.randomUUID(), name: "Migrated Reel Finisher project", createdAt: Date.now(), modifiedAt: Date.now(),
    settings: { width: frame.width, height: frame.height, frameRate: media.metadata.frameRate || 30, sampleRate: media.metadata.sampleRate || 48000, channels: 2 },
    mediaLibrary: { items: [media] }, timeline: { tracks: [videoTrack], duration: sourceToEdited(duration, cuts), subtitles: [], markers: [],
      backgroundFillMode: settings.composition.blur ? "blur" : "color", layoutBackgroundColor: settings.composition.background }, textClips: [] };
  const base = getCaptionStyle(settings.styleId);
  const brand = kit?.enabled ? { font: kit.font, textColor: kit.textColor, highlightColor: kit.highlightColor, fontSizeRatio: base.fontSizeRatio * kit.sizeScale, verticalPosition: kit.verticalPosition } : {};
  const captions = settings.captions ?? captionsFromLines(groupWords(words, { ...DEFAULT_GROUP_OPTIONS, ...base.group }));
  for (const caption of captions) {
    const track = captionTrack("Caption", { hidden: caption.hidden, locked: caption.locked }); project.timeline.tracks.unshift(track);
    const remapped = remapCaptionLines([{ ...caption, text: caption.words.map((word) => word.text).join(" ") }], cuts)[0];
    if (!remapped || remapped.end <= remapped.start) continue;
    const length = remapped.end - remapped.start;
    project.textClips!.push(makeCaption(project, track.id, remapped.text, remapped.start, length, { version: 1, kind: "caption", styleId: settings.styleId,
      baseAppearance: { ...brand, ...settings.appearance }, appearance: caption.appearance, animation: caption.animation ?? settings.animation, customAnimation: !!caption.animation,
      words: remapped.words.map((word) => ({ ...word, start: word.start - remapped.start, end: word.end - remapped.start })), referenceDuration: length, referenceFontSize: 1, timing: caption.estimated ? "estimated" : "verified-words" }, fonts));
  }
  for (const overlay of settings.overlays) {
    const pieces = retainedPieces(overlay.start, overlay.end, cuts); if (!pieces.length) continue;
    const start = sourceToEdited(overlay.start, cuts), length = sourceToEdited(overlay.end, cuts) - start;
    const track = captionTrack("Text overlay", { role: "general", hidden: overlay.hidden, locked: overlay.locked }); project.timeline.tracks.unshift(track);
    project.textClips!.push(makeCaption(project, track.id, overlay.text, start, length, { version: 1, kind: "overlay", styleId: "subtitle", timing: "estimated", referenceDuration: length, referenceFontSize: 1,
      words: estimatedWords(overlay.text, length), appearance: { font: overlay.font, weight: overlay.weight, fontSizeRatio: overlay.size, textColor: overlay.color, opacity: overlay.opacity, horizontalPosition: overlay.x, verticalPosition: overlay.y, ...overlay.appearance },
      animation: overlay.animation ?? { effect: "none", duration: 0.25, intensity: 0.5 } }, fonts));
  }
  return project;
}
