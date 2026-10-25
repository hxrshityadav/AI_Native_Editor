import { z } from "zod";
import { editDecisionListSchema } from "./edit/timeline";
import { localDb as db } from "./localDb";

/**
 * Caption drafts, saved in this browser only (IndexedDB) so a reload or crash
 * doesn't lose a transcript or the user's edits. Keyed by a content hash, so
 * no file names are stored.
 */

const wordSchema = z.object({ text: z.string(), start: z.number(), end: z.number() });

export const draftSchema = z.object({
  version: z.literal(1),
  fingerprint: z.string(),
  savedAt: z.number(),
  providerName: z.string(),
  transcript: z.array(wordSchema),
  /** Null when the user hasn't edited the transcript. */
  edited: z.array(wordSchema).nullable(),
  /** Caption style id; absent in drafts saved before styles existed. */
  styleId: z.string().optional(),
  /** Applied cuts (source time); absent before silence removal existed. */
  edl: editDecisionListSchema.optional(),
});
export type Draft = z.infer<typeof draftSchema>;

/** Drafts beyond this count are pruned oldest-first. */
export const MAX_DRAFTS = 20;
const SAMPLE_BYTES = 1024 * 1024;

/**
 * SHA-256 of the file size plus its first and last 1 MiB.
 * shortcut: two files with identical size, head and tail would share a draft;
 * real recordings differ in both, so hash the whole file only if that shows up.
 */
export async function fingerprintFile(file: Blob): Promise<string> {
  const head = await file.slice(0, SAMPLE_BYTES).arrayBuffer();
  const tail = await file.slice(Math.max(0, file.size - SAMPLE_BYTES)).arrayBuffer();
  const sizeBytes = new TextEncoder().encode(String(file.size));
  const data = new Uint8Array(sizeBytes.length + head.byteLength + tail.byteLength);
  data.set(sizeBytes);
  data.set(new Uint8Array(head), sizeBytes.length);
  data.set(new Uint8Array(tail), sizeBytes.length + head.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Validates a stored record; old or corrupted records read as null instead of crashing the editor. */
export function parseDraft(value: unknown): Draft | null {
  const parsed = draftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function loadDraft(fingerprint: string): Promise<Draft | null> {
  return parseDraft(await (await db()).get("drafts", fingerprint));
}

export async function saveDraft(draft: Draft): Promise<void> {
  const database = await db();
  await database.put("drafts", draft);
  const keys = await database.getAllKeysFromIndex("drafts", "savedAt");
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_DRAFTS))) await database.delete("drafts", key);
}

export async function deleteDraft(fingerprint: string): Promise<void> {
  await (await db()).delete("drafts", fingerprint);
}
