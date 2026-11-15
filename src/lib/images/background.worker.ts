import { removeBackground, type BackgroundRequest } from "./background";
const scope = self as unknown as { onmessage: (event: MessageEvent<BackgroundRequest>) => void; postMessage: (message: unknown) => void };
scope.onmessage = async ({ data }) => {
  try { scope.postMessage({ result: await removeBackground(data, status => scope.postMessage({ status })) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : "Background removal failed. Try another image." }); }
};
