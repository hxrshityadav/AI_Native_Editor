import { convertLegacy, migrationProblems } from "./legacy-convert";
import type { Project, MediaItem } from "@openreel/core";
import { localDb } from "../../../../../../src/lib/localDb";
import { draftSchema, fingerprintFile, loadDraft } from "../../../../../../src/lib/drafts";
import { editingSchema } from "../../../../../../src/lib/editor/project";
import { loadBrandKit } from "../../../../../../src/lib/brandKit";
import { FONT_CATALOG, listLocalFonts } from "../../../../../../src/lib/editor/fontLibrary";
import { getMediaBridge, initializeMediaBridge } from "../bridges/media-bridge";
import { saveMediaBlob } from "../services/media-storage";
import { useProjectStore } from "../stores/project-store";
import { ensureLocalCaptionFonts } from "./captions";

export async function legacyRecords(): Promise<{ fingerprint: string; savedAt: number }[]> {
  const database = await localDb();
  const drafts = (await database.getAll("drafts")).flatMap((value) => { const parsed = draftSchema.safeParse(value); return parsed.success ? [{ fingerprint: parsed.data.fingerprint, savedAt: parsed.data.savedAt }] : []; });
  for (const key of await database.getAllKeys("settings")) if (key.startsWith("project:") && !drafts.some((draft) => draft.fingerprint === key.slice(8))) {
    const value = await database.get("settings", key);
    if (editingSchema.safeParse(value).success) drafts.push({ fingerprint: key.slice(8), savedAt: typeof value === "object" && value && "savedAt" in value ? Number(value.savedAt) : 0 });
  }
  return drafts.sort((a, b) => b.savedAt - a.savedAt);
}
export type MigrationReview = { project: Project; file: File; problems: string[]; fingerprint: string };
export async function reviewMigration(fingerprint: string, file: File): Promise<MigrationReview> {
  if (await fingerprintFile(file) !== fingerprint) throw new Error("This is not the original media for this draft. Select the original file; the saved draft has not changed.");
  const database = await localDb();
  const draft = await loadDraft(fingerprint);
  const stored = await database.get("settings", `project:${fingerprint}`);
  const settings = editingSchema.parse(stored ?? draft?.editing ?? { styleId: draft?.styleId });
  await initializeMediaBridge();
  const result = await getMediaBridge().importFile(file, true, true);
  if (!result.success || !result.media?.metadata.hasVideo) throw new Error("The browser cannot decode this original video. Try a supported MP4/WebM file in the legacy editor.");
  const metadata = result.media.metadata;
  const media: MediaItem = { id: crypto.randomUUID(), name: file.name, type: "video", blob: file, fileHandle: null, thumbnailUrl: null, waveformData: null,
    metadata: { duration: metadata.duration, width: metadata.width, height: metadata.height, frameRate: metadata.frameRate || 30, codec: metadata.codec, sampleRate: metadata.sampleRate || 48000, channels: metadata.channels || 2, fileSize: file.size, hasAudio: metadata.hasAudio, hasVideo: true },
    sourceFile: { name: file.name, size: file.size, lastModified: file.lastModified } };
  const words = settings.wordEdits ?? draft?.edited ?? draft?.transcript ?? [];
  const fonts = [...FONT_CATALOG, ...await listLocalFonts()];
  const problems = migrationProblems(settings, media.metadata.duration);
  const requested = [settings.appearance.font, ...settings.captions?.map((caption) => caption.appearance.font) ?? [], ...settings.overlays.flatMap((overlay) => [overlay.font, overlay.appearance?.font])];
  if (requested.some((id) => id && !fonts.some((font) => font.id === id))) problems.push("A caption font is missing. Restore the uploaded font in the legacy editor before migration.");
  return { project: convertLegacy(settings, words, media, fonts, await loadBrandKit()), file, fingerprint, problems };
}
export async function completeMigration(review: MigrationReview): Promise<void> {
  if (review.problems.length) throw new Error("Resolve the reported compatibility issues in the legacy editor first.");
  if (await fingerprintFile(review.file) !== review.fingerprint) throw new Error("Media identity changed. Review the original file again.");
  await ensureLocalCaptionFonts(true);
  const media = review.project.mediaLibrary.items[0];
  await saveMediaBlob(review.project.id, media.id, review.file, media.metadata);
  // New UUID and separate OpenReel storage. No writes or deletes in the legacy database.
  useProjectStore.getState().loadProject(review.project);
  await useProjectStore.getState().forceSave();
}
