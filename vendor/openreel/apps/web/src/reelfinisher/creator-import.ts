import type { MediaItem } from "@openreel/core";
import { loadCreatorHandoff, consumeCreatorHandoff } from "../../../../../../src/lib/localtools/creator-handoff";
import { defaultEditing } from "../../../../../../src/lib/editor/project";
import { convertLegacy } from "./legacy-convert";
import { getMediaBridge, initializeMediaBridge } from "../bridges/media-bridge";
import { saveMediaBlob, deleteProjectMedia } from "../services/media-storage";
import { ensureLocalCaptionFonts } from "./captions";
import { useProjectStore } from "../stores/project-store";
import { assertVideoDuration } from "../../../../../../src/lib/media/duration";
import { autoSaveManager } from "../services/auto-save";

/** One-shot import into a new native project; no second renderer or timeline state. */
export async function importCreatorProject(id: string): Promise<void> {
  const { file, spec } = await loadCreatorHandoff(id);
  await initializeMediaBridge();
  const imported = await getMediaBridge().importFile(file, true, true);
  if (!imported.success || !imported.media?.metadata.hasVideo) throw new Error("The original video cannot be decoded. Convert it locally and retry Shorts Maker.");
  const metadata = imported.media.metadata;
  assertVideoDuration(metadata.duration);
  if (Math.abs(metadata.duration - spec.duration) > .1) throw new Error("The source duration changed. Review the original again in Shorts Maker.");
  const media: MediaItem = { id: crypto.randomUUID(), name: file.name, type: "video", blob: file, fileHandle: null, thumbnailUrl: null, waveformData: null,
    metadata: { duration: metadata.duration, width: metadata.width, height: metadata.height, frameRate: metadata.frameRate || 30, codec: metadata.codec, sampleRate: metadata.sampleRate || 48000, channels: metadata.channels || 2, fileSize: file.size, hasAudio: metadata.hasAudio, hasVideo: true },
    sourceFile: { name: file.name, size: file.size, lastModified: file.lastModified } };
  const settings = defaultEditing();
  settings.exportPreset = spec.quality;
  settings.composition = { ...settings.composition, ratio: spec.shape, x: spec.x, y: spec.y };
  settings.cuts = [...(spec.start > 0 ? [{ start: 0, end: spec.start }] : []), ...(spec.end < metadata.duration ? [{ start: spec.end, end: metadata.duration }] : [])];
  settings.captions = spec.cues.map(cue => {
    const words = cue.text.split(/\s+/).filter(Boolean), span = cue.end - cue.start;
    return { id: crypto.randomUUID(), start: cue.start, end: cue.end, appearance: {}, hidden: false, locked: false, estimated: true,
      words: words.map((text, i) => ({ text, start: cue.start + span * i / words.length, end: cue.start + span * (i + 1) / words.length })) };
  });
  const project = { ...convertLegacy(settings, [], media), name: "Detected Short" };
  await ensureLocalCaptionFonts();
  const previous = useProjectStore.getState().getFullProject();
  try {
    await saveMediaBlob(project.id, media.id, file, media.metadata);
    useProjectStore.getState().loadProject(project);
    await useProjectStore.getState().forceSave();
  } catch {
    useProjectStore.getState().loadProject(previous);
    autoSaveManager.markDirty(previous);
    await deleteProjectMedia(project.id).catch(() => {});
    throw new Error("The new project could not be saved. Free browser storage and retry; the source handoff is retained.");
  }
  await consumeCreatorHandoff(id).catch(() => {});
  location.hash = "/editor";
}
