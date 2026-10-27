import { encodeToTarget, fitWithin, imageHeader, validateDimensions, validateImageFile, type ImageFormat } from "./policy";

export type ImageRequest = { kind: "inspect"; file: File } | { kind: "process"; file: File; width: number; height: number; format: ImageFormat; quality: number; targetBytes?: number; background: string };
export type ImageInfo = { width: number; height: number; format: ImageFormat; transparent: boolean; preview: Blob };
export type ImageOutput = { blob: Blob; preview: Blob; width: number; height: number; format: ImageFormat; quality: number; targetMet: boolean };
export class ImageCapabilityError extends Error {}
const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError"); };

function canvas(width: number, height: number) {
  if (typeof document !== "undefined") { const result = document.createElement("canvas"); result.width = width; result.height = height; return result; }
  if (typeof OffscreenCanvas !== "undefined" && typeof OffscreenCanvas.prototype.convertToBlob === "function") return new OffscreenCanvas(width, height);
  throw new ImageCapabilityError("Image processing is unavailable in this browser. Try a current Chrome, Edge, Firefox or Safari.");
}
async function encode(surface: OffscreenCanvas | HTMLCanvasElement, format: ImageFormat, quality: number, signal?: AbortSignal): Promise<Blob> {
  checkAbort(signal);
  const blob = "convertToBlob" in surface ? await surface.convertToBlob({ type: format, quality }) : await new Promise<Blob>((resolve, reject) => surface.toBlob(blob => blob ? resolve(blob) : reject(new Error("The browser could not encode this image. Try smaller dimensions or another format.")), format, quality));
  checkAbort(signal);
  if (blob.type !== format) throw new Error("This browser cannot encode the selected format. Choose PNG or JPEG, or try another browser.");
  if (!blob.size || blob.size > 64 * 1024 * 1024) throw new Error("The output is empty or too large. Use smaller dimensions or another format.");
  return blob;
}
async function decode(file: File, signal?: AbortSignal): Promise<{ image: CanvasImageSource; width: number; height: number; close: () => void }> {
  checkAbort(signal);
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  if (typeof Image === "undefined") throw new ImageCapabilityError("Image decoding is unavailable in this browser. Try another browser.");
  const url = URL.createObjectURL(file), image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () => { image.src = ""; reject(new DOMException("Operation cancelled", "AbortError")); };
      signal?.addEventListener("abort", abort, { once: true });
      image.onload = () => { signal?.removeEventListener("abort", abort); resolve(); };
      image.onerror = () => { signal?.removeEventListener("abort", abort); reject(new Error("Cannot decode this image.")); };
      image.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = ""; URL.revokeObjectURL(url); } };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}
async function thumbnail(source: CanvasImageSource, width: number, height: number, signal?: AbortSignal) {
  const size = fitWithin(width, height, 1024, 1024), surface = canvas(size.width, size.height);
  try { const context = surface.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) throw new ImageCapabilityError("A 2D canvas is unavailable. Try another browser.");
    context.drawImage(source, 0, 0, size.width, size.height); return await encode(surface, "image/png", 1, signal);
  } finally { surface.width = surface.height = 1; }
}
export async function processImage(request: ImageRequest, signal?: AbortSignal): Promise<ImageInfo | ImageOutput> {
  validateImageFile(request.file);
  const header = imageHeader(new Uint8Array(await request.file.slice(0, 1024 * 1024).arrayBuffer()));
  const declared = request.file.type === "image/jpg" ? "image/jpeg" : request.file.type;
  if (declared && declared !== "application/octet-stream" && declared !== header.format) throw new Error("The image's MIME type does not match its contents. Re-export the original image and try again.");
  checkAbort(signal);
  let decoded: Awaited<ReturnType<typeof decode>>;
  try { decoded = await decode(request.file, signal); } catch (error) {
    if (error instanceof ImageCapabilityError || error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("This image cannot be decoded. It may be damaged or unsupported. Re-export it and try again.");
  }
  let surface: OffscreenCanvas | HTMLCanvasElement | undefined;
  try {
    checkAbort(signal); validateDimensions(decoded.width, decoded.height);
    const width = request.kind === "inspect" ? decoded.width : request.width, height = request.kind === "inspect" ? decoded.height : request.height;
    validateDimensions(width, height);
    surface = canvas(width, height);
    const context = surface.getContext("2d", { willReadFrequently: request.kind === "inspect" }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) throw new ImageCapabilityError("A 2D canvas is unavailable. Try another browser.");
    if (request.kind === "process" && request.format === "image/jpeg") { if (!/^#[0-9a-f]{6}$/i.test(request.background)) throw new Error("Choose a valid background colour."); context.fillStyle = request.background; context.fillRect(0, 0, width, height); }
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high"; context.drawImage(decoded.image, 0, 0, width, height);
    if (request.kind === "inspect") {
      let transparent = false;
      if (header.format !== "image/jpeg") for (let y = 0; y < height && !transparent; y += 128) {
        checkAbort(signal); const pixels = context.getImageData(0, y, width, Math.min(128, height - y)).data;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) { transparent = true; break; }
      }
      return { width, height, format: header.format, transparent, preview: await thumbnail(surface, width, height, signal) };
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(request.format)) throw new Error("Choose JPEG, PNG or WebP output.");
    const result = request.format === "image/png" ? { blob: await encode(surface, request.format, 1, signal), quality: 1, targetMet: true } : await encodeToTarget(quality => encode(surface!, request.format, quality, signal), request.quality, request.targetBytes);
    return { ...result, targetMet: !request.targetBytes || result.blob.size <= request.targetBytes, width, height, format: request.format, preview: await thumbnail(surface, width, height, signal) };
  } finally { decoded.close(); if (surface) surface.width = surface.height = 1; }
}
