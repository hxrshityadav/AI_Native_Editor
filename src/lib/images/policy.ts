export const IMAGE_FORMATS = { "image/jpeg": { label: "JPEG", extension: "jpg" }, "image/png": { label: "PNG", extension: "png" }, "image/webp": { label: "WebP", extension: "webp" } } as const;
export type ImageFormat = keyof typeof IMAGE_FORMATS;
export type ImageTool = "compressor" | "resizer" | "converter";
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16_000_000;
export const MAX_IMAGE_SIDE = 8192;

export function validateImageFile(file: { size: number; type: string }): void {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error("Choose a non-empty image no larger than 25 MiB. Export a smaller copy and try again.");
  if (file.type && ![...Object.keys(IMAGE_FORMATS), "image/jpg", "application/octet-stream"].includes(file.type)) throw new Error("Choose a still JPEG, PNG or WebP image. This file type is not supported.");
}
export function validateDimensions(width: number, height: number): void {
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= MAX_IMAGE_SIDE) || width * height > MAX_IMAGE_PIXELS) throw new Error("Use positive whole-number dimensions up to 8192 px per side and 16 megapixels total. Resize a larger image elsewhere first.");
}
export function pairedDimensions(width: number, height: number, changed: "width" | "height", value: number, locked: boolean): { width: number; height: number } {
  if (!locked) return { width: changed === "width" ? value : width, height: changed === "height" ? value : height };
  return changed === "width" ? { width: value, height: Math.max(1, Math.round(value * height / width)) } : { height: value, width: Math.max(1, Math.round(value * width / height)) };
}
export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number) {
  const ratio = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
export function outputName(name: string, tool: ImageTool, format: ImageFormat): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100) || "image";
  return `${base}-${tool}.${IMAGE_FORMATS[format].extension}`;
}

/** Read dimensions before decoding, to reject oversized allocations and animated inputs. */
export function imageHeader(bytes: Uint8Array): { format: ImageFormat; width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  let format: ImageFormat, width = 0, height = 0;
  if (bytes.length >= 33 && bytes[0] === 137 && ascii(1, 7) === "PNG\r\n\x1a\n" && ascii(12, 4) === "IHDR") {
    format = "image/png"; width = view.getUint32(16); height = view.getUint32(20);
    let pixelsFound = false;
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const type = ascii(offset + 4, 4);
      if (type === "acTL") throw new Error("Animated PNG is not supported. Export a still frame first.");
      if (type === "IDAT") { pixelsFound = true; break; }
      const length = view.getUint32(offset); offset += length + 12;
    }
    if (!pixelsFound) throw new Error("Cannot read the PNG image data within its metadata limit. Re-export a still image and try again.");
  } else if (bytes.length >= 20 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    format = "image/webp";
    const chunk = ascii(12, 4);
    if (chunk === "VP8X" && bytes.length >= 30) {
      if (bytes[20] & 2) throw new Error("Animated WebP is not supported. Export a still frame first.");
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16); height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      width = 1 + bytes[21] + ((bytes[22] & 63) << 8); height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10);
    } else if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
      width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
    }
  } else if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216) {
    format = "image/jpeg";
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 1 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) { height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break; }
      offset += length;
    }
  } else throw new Error("The file contents are not JPEG, PNG or WebP. Choose the original image or re-export it.");
  if (!width || !height) throw new Error("Cannot read the image dimensions. The file may be damaged or contain too much metadata. Re-export it and try again.");
  validateDimensions(width, height);
  return { format, width, height };
}

/** Quality is a ceiling; select the highest measured candidate within the requested byte budget. */
export async function encodeToTarget(encode: (quality: number) => Promise<Blob>, quality: number, targetBytes?: number): Promise<{ blob: Blob; quality: number; targetMet: boolean }> {
  if (!Number.isFinite(quality) || quality < 0.01 || quality > 1 || targetBytes !== undefined && (!Number.isFinite(targetBytes) || targetBytes < 1)) throw new Error("Choose a valid quality and a positive target size.");
  const initial = await encode(quality);
  if (!targetBytes || initial.size <= targetBytes) return { blob: initial, quality, targetMet: true };
  let smallest = { blob: initial, quality }, feasible: typeof smallest | undefined;
  let low = 0.01, high = quality;
  for (let i = 0; i < 9; i++) {
    const candidateQuality = i === 0 ? low : (low + high) / 2;
    const blob = await encode(candidateQuality);
    if (blob.size < smallest.blob.size) smallest = { blob, quality: candidateQuality };
    if (blob.size <= targetBytes) { if (!feasible || candidateQuality > feasible.quality) feasible = { blob, quality: candidateQuality }; low = candidateQuality; }
    else { high = candidateQuality; if (i === 0) break; }
  }
  return { ...(feasible ?? smallest), targetMet: !!feasible };
}
