import * as ort from "site-ort/wasm";
import { imageHeader, validateDimensions, validateImageFile } from "./policy";

/*
 * Background removal with the U²-Net-p salient object detection model (Apache-2.0, 4.6 MB) on ONNX Runtime Web's
 * WebAssembly backend. Runs in a worker; the runtime (/ort/) and model (/models/u2netp/) are fetched from this site the
 * first time a user removes a background. Nothing is uploaded.
 */

export type BackgroundFormat = "image/png" | "image/webp";
export type BackgroundRequest = { file: File; format: BackgroundFormat; fill?: string };
export type BackgroundResult = { blob: Blob; preview: Blob; width: number; height: number; format: BackgroundFormat; coverage: number };

const MODEL_URL = "/models/u2netp/u2netp.onnx", SIZE = 320;
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];
let session: Promise<ort.InferenceSession> | undefined;
function loadModel() {
  ort.env.wasm.wasmPaths = { wasm: "/ort/ort-wasm-simd-threaded.wasm" }; // the JS glue is already in the bundle
  ort.env.wasm.numThreads = 1; // public tool pages are not cross-origin isolated, so no shared-memory threads
  return session ??= fetch(MODEL_URL).then(response => {
    if (!response.ok) throw new Error("The background model could not be downloaded. Check your connection and try again.");
    return response.arrayBuffer();
  }).then(model => ort.InferenceSession.create(model, { executionProviders: ["wasm"] })).catch(error => { session = undefined; throw error; });
}

const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError"); };
const context2d = (surface: OffscreenCanvas) => { const context = surface.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("A 2D canvas is unavailable. Try another browser."); return context; };

export async function removeBackground({ file, format, fill }: BackgroundRequest, onStatus: (status: string) => void, signal?: AbortSignal): Promise<BackgroundResult> {
  validateImageFile(file);
  const header = imageHeader(new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer()));
  const declared = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (declared && declared !== "application/octet-stream" && declared !== header.format) throw new Error("The image's MIME type does not match its contents. Re-export the original image and try again.");
  if (fill !== undefined && !/^#[0-9a-f]{6}$/i.test(fill)) throw new Error("Choose a valid background colour.");

  onStatus("Loading the background model. The first time downloads about 19 MB; later runs reuse it.");
  const model = await loadModel();
  checkAbort(signal);
  onStatus("Finding the subject…");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const width = bitmap.width, height = bitmap.height;
  const surfaces: OffscreenCanvas[] = [];
  const canvas = (w: number, h: number) => { const surface = new OffscreenCanvas(w, h); surfaces.push(surface); return surface; };
  try {
    validateDimensions(width, height);
    // Model input: 320 × 320 RGB, ImageNet mean/std, channels first.
    const small = canvas(SIZE, SIZE), smallContext = context2d(small);
    smallContext.drawImage(bitmap, 0, 0, SIZE, SIZE);
    const rgba = smallContext.getImageData(0, 0, SIZE, SIZE).data, input = new Float32Array(3 * SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) for (let c = 0; c < 3; c++) input[c * SIZE * SIZE + i] = (rgba[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    const outputs = await model.run({ [model.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
    checkAbort(signal);
    const prediction = outputs[model.outputNames[0]].data as Float32Array;
    let min = Infinity, max = -Infinity;
    for (const value of prediction) { if (value < min) min = value; if (value > max) max = value; }
    const range = max - min || 1;

    onStatus("Creating the cut-out at full resolution…");
    const maskSmall = canvas(SIZE, SIZE), maskSmallContext = context2d(maskSmall), maskPixels = maskSmallContext.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) maskPixels.data[i * 4 + 3] = Math.round((prediction[i] - min) / range * 255);
    maskSmallContext.putImageData(maskPixels, 0, 0);
    const mask = canvas(width, height), maskContext = context2d(mask);
    maskContext.imageSmoothingEnabled = true; maskContext.imageSmoothingQuality = "high"; maskContext.drawImage(maskSmall, 0, 0, width, height);
    const alpha = maskContext.getImageData(0, 0, width, height).data;
    const cutout = canvas(width, height), cutoutContext = context2d(cutout);
    cutoutContext.drawImage(bitmap, 0, 0);
    const pixels = cutoutContext.getImageData(0, 0, width, height);
    let kept = 0;
    for (let i = 3; i < pixels.data.length; i += 4) { pixels.data[i] = Math.round(pixels.data[i] * alpha[i] / 255); if (pixels.data[i] > 127) kept++; }
    cutoutContext.putImageData(pixels, 0, 0);
    checkAbort(signal);

    let result = cutout;
    if (fill) { result = canvas(width, height); const resultContext = context2d(result); resultContext.fillStyle = fill; resultContext.fillRect(0, 0, width, height); resultContext.drawImage(cutout, 0, 0); }
    const blob = await result.convertToBlob({ type: format });
    if (blob.type !== format) throw new Error("This browser cannot encode the selected format. Choose PNG.");
    const scale = Math.min(1, 1024 / Math.max(width, height)), thumb = canvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    context2d(thumb).drawImage(result, 0, 0, thumb.width, thumb.height);
    const preview = await thumb.convertToBlob({ type: "image/png" });
    return { blob, preview, width, height, format, coverage: kept / (width * height) };
  } finally { bitmap.close(); for (const surface of surfaces) surface.width = surface.height = 1; }
}
