import { audioPeaks, inspectMedia, processMedia, type MediaRequest } from "./engine";
import { videoToGif } from "./gif";
import { audioToVideo } from "./audiovideo";
const scope = self as unknown as { onmessage: (event: MessageEvent<MediaRequest>) => void; postMessage: (value: unknown) => void };
scope.onmessage = async ({ data }) => {
  try {
    const result = data.kind === "inspect" ? await inspectMedia(data.file, data.expect) : data.kind === "peaks" ? await audioPeaks(data.file)
      : data.kind === "audiovideo" ? await audioToVideo(data.file, data.options, value => scope.postMessage({ type: "progress", value }), value => scope.postMessage({ type: "phase", value }))
      : data.kind === "gif" ? await videoToGif(data.file, data.options, value => scope.postMessage({ type: "progress", value }), value => scope.postMessage({ type: "phase", value }))
      : await processMedia(data.file, data.operation, value => scope.postMessage({ type: "progress", value }), value => scope.postMessage({ type: "phase", value }));
    scope.postMessage({ type: "done", result });
  } catch (error) { scope.postMessage({ type: "error", message: error instanceof Error ? error.message : "Media processing failed. Try another file or browser." }); }
};
