/*
 * HEIC/HEIF to JPEG. Decoding uses libheif (LGPL-3.0, via libheif-js) compiled to WebAssembly and loaded only inside
 * the HEIC worker; encoding uses the browser's JPEG encoder. Nothing is uploaded.
 */

export const MAX_HEIC_BYTES = 25 * 1024 * 1024;
/** iPhone 48 MP photos fit; larger images risk running out of memory on phones. */
export const MAX_HEIC_PIXELS = 50_000_000;
export const MAX_HEIC_SIDE = 12_000;
export const MAX_HEIC_FILES = 20;
const BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1", "avci"]);

export type HeicRequest = { file: File; quality: number };
export type HeicResult = { blob: Blob; preview: Blob; width: number; height: number; images: number };

/** True when the ISO-BMFF `ftyp` box names a HEIF brand (major or compatible). File names and MIME types are not trusted. */
export function isHeif(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  const ascii = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (ascii(4) !== "ftyp") return false;
  const size = Math.min(bytes.length, new DataView(bytes.buffer, bytes.byteOffset).getUint32(0));
  if (BRANDS.has(ascii(8))) return true;
  for (let offset = 16; offset + 4 <= size; offset += 4) if (BRANDS.has(ascii(offset))) return true;
  return false;
}

export function validateHeicFile(file: { size: number }) {
  if (!file.size || file.size > MAX_HEIC_BYTES) throw new Error("Choose a non-empty HEIC file no larger than 25 MiB.");
}
export function validateHeicDimensions(width: number, height: number) {
  if (!(width > 0 && height > 0) || width > MAX_HEIC_SIDE || height > MAX_HEIC_SIDE || width * height > MAX_HEIC_PIXELS) throw new Error("This photo is larger than 50 megapixels, which this converter supports. Export a smaller copy and try again.");
}

export const jpegName = (name: string) => `${name.replace(/\.(heic|heif|hif)$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100) || "photo"}.jpg`;

type Libheif = { HeifDecoder: new () => { decode(data: ArrayBuffer | Uint8Array): HeifImage[] } };
type HeifImage = { get_width(): number; get_height(): number; display(target: { data: Uint8ClampedArray; width: number; height: number }, done: (result: { data: Uint8ClampedArray } | null) => void): void; free?: () => void };
let libheif: Promise<Libheif> | undefined;
const loadLibheif = () => libheif ??= import("libheif-js/libheif-wasm/libheif-bundle.mjs").then(module => (module as unknown as { default: () => Promise<Libheif> }).default());

const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError"); };

/** Decode the primary image (the first top-level image) with its rotation and mirroring applied, then encode JPEG. */
export async function convertHeic({ file, quality }: HeicRequest, signal?: AbortSignal): Promise<HeicResult> {
  validateHeicFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isHeif(bytes)) throw new Error("This file is not a HEIC or HEIF image. Choose a .heic or .heif photo.");
  checkAbort(signal);
  const decoder = new (await loadLibheif()).HeifDecoder();
  let images: HeifImage[];
  try { images = decoder.decode(bytes); } catch { images = []; }
  if (!images.length) throw new Error("This HEIC file cannot be decoded. It may be damaged or use an unsupported variant.");
  const image = images[0], width = image.get_width(), height = image.get_height();
  try {
    validateHeicDimensions(width, height);
    checkAbort(signal);
    const pixels = await new Promise<Uint8ClampedArray>((resolve, reject) => image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, result => result ? resolve(result.data) : reject(new Error("This HEIC file cannot be decoded. It may be damaged or use an unsupported variant."))));
    checkAbort(signal);
    const surface = new OffscreenCanvas(width, height), context = surface.getContext("2d");
    if (!context) throw new Error("A 2D canvas is unavailable. Try another browser.");
    // JPEG has no alpha: composite any transparency onto white before encoding.
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, width, height);
    const layer = new OffscreenCanvas(width, height), layerContext = layer.getContext("2d")!;
    layerContext.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0); context.drawImage(layer, 0, 0); layer.width = layer.height = 1;
    const blob = await surface.convertToBlob({ type: "image/jpeg", quality });
    if (blob.type !== "image/jpeg" || !blob.size) throw new Error("This browser cannot encode JPEG. Try another browser.");
    checkAbort(signal);
    const scale = Math.min(1, 512 / Math.max(width, height)), thumb = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    thumb.getContext("2d")!.drawImage(surface, 0, 0, thumb.width, thumb.height);
    const preview = await thumb.convertToBlob({ type: "image/jpeg", quality: 0.8 });
    surface.width = surface.height = thumb.width = thumb.height = 1;
    return { blob, preview, width, height, images: images.length };
  } finally { for (const entry of images) entry.free?.(); }
}
