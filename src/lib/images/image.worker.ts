import { ImageCapabilityError, processImage, type ImageRequest } from "./engine";
const scope = self as unknown as { onmessage: (event: MessageEvent<ImageRequest>) => void; postMessage: (message: unknown) => void };
scope.onmessage = async ({ data }) => {
  try { scope.postMessage({ result: await processImage(data) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : "Image processing failed. Try a smaller image.", unsupported: error instanceof ImageCapabilityError }); }
};
