import { z } from "zod";
import { CAPTION_FONTS, loadCaptionFont, type CaptionFontId } from "../captions/fonts";
import { localDb } from "../localDb";

export const FONT_CATEGORIES = ["Sans Serif", "Serif", "Display", "Monospace", "Handwriting"] as const;
export const fontRecordSchema = z.object({
  id: z.string(), label: z.string().min(1).max(60), family: z.string(),
  category: z.enum(FONT_CATEGORIES), weights: z.array(z.number()).min(1),
  url: z.string().optional(), blob: z.instanceof(Blob).optional(),
});
export type FontRecord = z.infer<typeof fontRecordSchema>;
export const FONT_CATALOG: FontRecord[] = [
  ...Object.entries(CAPTION_FONTS).map(([id, font]) => ({ id, label: font.label, family: font.family,
    category: (id === "baloo-2" ? "Display" : "Sans Serif") as FontRecord["category"], weights: [font.weight] })),
  { id: "asset:notoserif", label: "Noto Serif", family: "RF Noto Serif", category: "Serif", weights: [400, 500, 600, 700, 800, 900], url: "/fonts/catalog/notoserif/font.ttf" },
  { id: "asset:robotomono", label: "Roboto Mono", family: "RF Roboto Mono", category: "Monospace", weights: [100, 200, 300, 400, 500, 600, 700], url: "/fonts/catalog/robotomono/font.ttf" },
  { id: "asset:caveat", label: "Caveat", family: "RF Caveat", category: "Handwriting", weights: [400, 500, 600, 700], url: "/fonts/catalog/caveat/font.ttf" },
  { id: "asset:anton", label: "Anton", family: "RF Anton", category: "Display", weights: [400], url: "/fonts/catalog/anton/font.ttf" },
];
export const MAX_FONT_BYTES = 10 * 1024 * 1024;
export function validateFontFile(file: { name: string; size: number; type: string }): string | null {
  if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) return "Choose a WOFF2, WOFF, TTF, or OTF font.";
  if (file.size <= 0 || file.size > MAX_FONT_BYTES) return "Font files must be non-empty and no larger than 10 MB.";
  if (file.type && !/^(font\/|application\/(?:octet-stream|x-font|font|vnd\.ms-fontobject))/i.test(file.type)) return "This file is not identified as a font. Choose the original font file.";
  return null;
}

const fontLoads = new WeakMap<FontFaceSet, Map<string, Promise<void>>>();
export async function loadLibraryFont(record: FontRecord, fonts: FontFaceSet) {
  if (record.id in CAPTION_FONTS) return loadCaptionFont(record.id as CaptionFontId, fonts);
  let loads = fontLoads.get(fonts);
  if (!loads) fontLoads.set(fonts, loads = new Map());
  let pending = loads.get(record.id);
  if (!pending) {
    pending = (async () => {
      const source = record.blob ? await record.blob.arrayBuffer() : `url("${record.url}")`;
      const weights = record.weights;
      const weight = weights.length > 1 ? `${Math.min(...weights)} ${Math.max(...weights)}` : String(weights[0]);
      fonts.add(await new FontFace(record.family, source, { weight }).load());
    })();
    loads.set(record.id, pending);
    pending.catch(() => loads!.delete(record.id));
  }
  return pending;
}

export async function importFont(file: File): Promise<FontRecord> {
  const problem = validateFontFile(file);
  if (problem) throw new Error(problem);
  const id = `local:${crypto.randomUUID()}`;
  const record: FontRecord = { id, family: `RF-${id.replace(/[^a-z0-9-]/gi, "")}`,
    label: file.name.replace(/\.[^.]+$/, "").slice(0, 60), category: "Display", weights: [400], blob: file };
  // Browser parsing is the acceptance test; extensions and MIME alone cannot prove a font works.
  await loadLibraryFont(record, document.fonts).catch(() => { throw new Error("This browser couldn't parse the font. Try another font file."); });
  await localDb().then((database) => database.put("settings", record, id)).catch(() => {
    throw new Error("The font parsed, but couldn't be stored. Remove unused fonts or free browser storage, then upload it again.");
  });
  return record;
}
export async function listLocalFonts(): Promise<FontRecord[]> {
  const database = await localDb();
  const keys = await database.getAllKeys("settings");
  const records = await Promise.all(keys.filter((key) => key.startsWith("local:")).map((key) => database.get("settings", key)));
  return records.flatMap((value) => { const record = fontRecordSchema.safeParse(value); return record.success ? [record.data] : []; });
}
export async function removeLocalFont(id: string) {
  const database = await localDb();
  const parsed = fontRecordSchema.safeParse(await database.get("settings", id));
  await database.delete("settings", id);
  if (parsed.success) for (const face of document.fonts) {
    if (face.family === parsed.data.family) document.fonts.delete(face);
  }
  fontLoads.get(document.fonts)?.delete(id);
}
export async function renameLocalFont(font: FontRecord, label: string) {
  const renamed = fontRecordSchema.parse({ ...font, label: label.trim() });
  await (await localDb()).put("settings", renamed, font.id);
}
