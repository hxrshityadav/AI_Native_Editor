/*
 * User-uploaded caption fonts (browser only). Files are untrusted data: only the extension, the size, the file signature
 * and the browser's own FontFace parser decide whether a file is used; nothing is executed or uploaded. Fonts are kept
 * in this browser's IndexedDB so they survive a reload; if storage is blocked they still work for the session.
 */
import { registerCustomFont, type Script } from "./captions";

export const MAX_FONT_BYTES = 15 * 1024 * 1024;
export type StoredFont = { id: string; label: string; scripts: Script[]; data: ArrayBuffer; added: number };

/** Checks extension, size and the first four bytes (TrueType, OpenType, WOFF, WOFF2). Font collections are refused. */
export function checkFontFile(name: string, bytes: Uint8Array): string | null {
  if (!/\.(ttf|otf|woff2?)$/i.test(name)) return "Choose a TTF, OTF, WOFF or WOFF2 font file.";
  if (!bytes.length || bytes.length > MAX_FONT_BYTES) return "Choose a font file up to 15 MB.";
  const tag = String.fromCharCode(...bytes.subarray(0, 4)), hex = [...bytes.subarray(0, 4)].map(b => b.toString(16).padStart(2, "0")).join("");
  if (tag === "ttcf") return "Font collections (.ttc) are not supported. Choose a single font file.";
  if (!(hex === "00010000" || tag === "true" || tag === "OTTO" || tag === "wOFF" || tag === "wOF2")) return "This file is not a valid font. It may be damaged or renamed.";
  return null;
}

/**
 * Which scripts a loaded family can draw. The sample is measured in the family (with a fallback) and in the fallback
 * alone. If the family lacks the glyphs, the browser draws them in the fallback and the two widths are identical; this
 * is checked against two different fallbacks, and the script counts only if the family changed both.
 */
export function measureScripts(family: string): Script[] {
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d")!;
  const width = (font: string, sample: string) => { ctx.font = font; return ctx.measureText(sample).width; };
  const covers = (sample: string) => ["serif", "monospace"].every(fallback => Math.abs(width(`48px "${family}", ${fallback}`, sample) - width(`48px ${fallback}`, sample)) > 0.5);
  const scripts: Script[] = [];
  if (covers("AaBbGgQqXyz")) scripts.push("latin");
  if (covers("कखगघचजनमसहअआइउ")) scripts.push("devanagari"); // no spaces: a Latin font supplies the space glyph
  return scripts;
}

/** Loads font bytes into a FontFaceSet under the registered family. Throws with a reason for malformed fonts. */
export async function loadFontData(family: string, data: ArrayBuffer, fonts: FontFaceSet) {
  const face = new FontFace(family, data);
  try { await face.load(); } catch { throw new Error("The browser could not read this font. It may be damaged or use an unsupported format."); }
  fonts.add(face);
}

export async function addCustomFont(file: File, label: string): Promise<StoredFont> {
  const data = await file.arrayBuffer(), problem = checkFontFile(file.name, new Uint8Array(data));
  if (problem) throw new Error(problem);
  const id = `custom:${Date.now().toString(36)}`, name = label.trim().slice(0, 40) || file.name.replace(/\.[^.]+$/, "").slice(0, 40);
  const entry = registerCustomFont({ id, label: name, scripts: [] });
  await loadFontData(entry.family, data, document.fonts);
  const scripts = measureScripts(entry.family);
  if (!scripts.length) throw new Error("This font has no Latin or Devanagari letters, so it cannot draw captions.");
  registerCustomFont({ id, label: name, scripts });
  const stored = { id, label: name, scripts, data, added: Date.now() };
  await storeFont(stored).catch(() => {});
  return stored;
}

/* IndexedDB persistence; every call tolerates blocked storage. */
const DB = "rf-caption-fonts";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const request = indexedDB.open(DB, 1); request.onupgradeneeded = () => request.result.createObjectStore("fonts", { keyPath: "id" }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function storeFont(font: StoredFont) { const db = await open(); await new Promise((resolve, reject) => { const tx = db.transaction("fonts", "readwrite"); tx.objectStore("fonts").put(font); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close(); }
export async function removeCustomFont(id: string) { try { const db = await open(); await new Promise(resolve => { const tx = db.transaction("fonts", "readwrite"); tx.objectStore("fonts").delete(id); tx.oncomplete = resolve; tx.onerror = resolve; }); db.close(); } catch { /* storage blocked: nothing persisted */ } }
/** Restores saved fonts into the page. Fonts that no longer load are skipped. */
export async function restoreCustomFonts(): Promise<StoredFont[]> {
  try {
    const db = await open(), all = await new Promise<StoredFont[]>((resolve, reject) => { const request = db.transaction("fonts").objectStore("fonts").getAll(); request.onsuccess = () => resolve(request.result as StoredFont[]); request.onerror = () => reject(request.error); }); db.close();
    const ok: StoredFont[] = [];
    for (const font of all) { const entry = registerCustomFont(font); try { await loadFontData(entry.family, font.data, document.fonts); ok.push(font); } catch { /* skip */ } }
    return ok;
  } catch { return []; }
}
