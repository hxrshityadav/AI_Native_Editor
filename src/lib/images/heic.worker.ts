import { convertHeic, type HeicRequest } from "./heic";
const scope = self as unknown as { onmessage: (event: MessageEvent<HeicRequest>) => void; postMessage: (message: unknown) => void };
scope.onmessage = async ({ data }) => {
  try { scope.postMessage({ result: await convertHeic(data) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : "HEIC conversion failed. Try another photo." }); }
};
