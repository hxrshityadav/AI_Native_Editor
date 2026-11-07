import type { CropRect } from "./engine";

/*
 * Passport and ID photo sizes. Presets describe the printed size only: head-size, expression, background and recency
 * rules differ by issuing authority and are not checked here, so no preset claims compliance with any country.
 * Add a size by appending to PHOTO_SIZES.
 */

export const DPI = 300;
export interface PhotoSize { id: string; label: string; widthMm: number; heightMm: number }
export const PHOTO_SIZES: PhotoSize[] = [
  { id: "35x45", label: "35 × 45 mm", widthMm: 35, heightMm: 45 },
  { id: "2x2in", label: "2 × 2 in (51 × 51 mm)", widthMm: 50.8, heightMm: 50.8 },
  { id: "40x50", label: "40 × 50 mm", widthMm: 40, heightMm: 50 },
  { id: "33x48", label: "33 × 48 mm", widthMm: 33, heightMm: 48 },
  { id: "35x35", label: "35 × 35 mm", widthMm: 35, heightMm: 35 },
  { id: "30x40", label: "30 × 40 mm", widthMm: 30, heightMm: 40 },
];

export const mmToPx = (mm: number) => Math.round(mm / 25.4 * DPI);
export const pixelSize = (size: PhotoSize) => ({ width: mmToPx(size.widthMm), height: mmToPx(size.heightMm) });

export const MIN_ZOOM = 0.5, MAX_ZOOM = 4;
/** Crop rectangle (in source pixels) of the photo's aspect ratio, centred on (cx, cy). Zoom 1 is the largest rectangle that fits inside the image. */
export function cropFor(imageWidth: number, imageHeight: number, aspect: number, zoom: number, cx: number, cy: number): CropRect {
  const baseWidth = Math.min(imageWidth, imageHeight * aspect), z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const width = baseWidth / z, height = width / aspect;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}
/** Keep the centre over the image so the subject can never be dragged completely out of the frame. */
export const clampCentre = (imageWidth: number, imageHeight: number, cx: number, cy: number) => ({ cx: Math.min(imageWidth, Math.max(0, cx)), cy: Math.min(imageHeight, Math.max(0, cy)) });

/** 6 × 4 in print sheet layout at 300 DPI: as many copies as fit with gaps for cutting. */
export function sheetLayout(photo: { width: number; height: number }, sheet = { width: 6 * DPI, height: 4 * DPI }, margin = 45, gap = 30) {
  const columns = Math.max(0, Math.floor((sheet.width - 2 * margin + gap) / (photo.width + gap)));
  const rows = Math.max(0, Math.floor((sheet.height - 2 * margin + gap) / (photo.height + gap)));
  const usedWidth = columns * photo.width + (columns - 1) * gap, usedHeight = rows * photo.height + (rows - 1) * gap;
  const left = Math.round((sheet.width - usedWidth) / 2), top = Math.round((sheet.height - usedHeight) / 2);
  const positions: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) positions.push({ x: left + column * (photo.width + gap), y: top + row * (photo.height + gap) });
  return { ...sheet, positions };
}

/** Tile a finished photo onto a white JPEG print sheet with thin grey cut guides. Runs in the browser; nothing is uploaded. */
export async function composeSheet(photo: Blob, size: { width: number; height: number }): Promise<Blob> {
  const layout = sheetLayout(size);
  if (!layout.positions.length) throw new Error("This photo size does not fit on a 6 × 4 in sheet.");
  const bitmap = await createImageBitmap(photo);
  const surface = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(layout.width, layout.height) : Object.assign(document.createElement("canvas"), { width: layout.width, height: layout.height });
  try {
    const context = surface.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) throw new Error("A 2D canvas is unavailable. Try another browser.");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, layout.width, layout.height);
    context.strokeStyle = "#c8c8c8"; context.lineWidth = 2;
    for (const { x, y } of layout.positions) { context.drawImage(bitmap, x, y, size.width, size.height); context.strokeRect(x - 1, y - 1, size.width + 2, size.height + 2); }
    const blob = "convertToBlob" in surface ? await surface.convertToBlob({ type: "image/jpeg", quality: 0.95 }) : await new Promise<Blob>((resolve, reject) => (surface as HTMLCanvasElement).toBlob(value => value ? resolve(value) : reject(new Error("The browser could not encode the print sheet.")), "image/jpeg", 0.95));
    if (blob.type !== "image/jpeg") throw new Error("This browser cannot encode JPEG. Try another browser.");
    return blob;
  } finally { bitmap.close(); surface.width = surface.height = 1; }
}
