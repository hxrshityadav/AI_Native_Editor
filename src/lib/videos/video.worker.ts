import { compressVideo, inspectVideo, videoSupport, type VideoRequest } from "./engine";
const scope = self as unknown as { onmessage: (event: MessageEvent<VideoRequest>) => void; postMessage: (value: unknown) => void };
scope.onmessage = async ({ data }) => {
  try {
    const result = data.kind === "inspect" ? await inspectVideo(data.file) : data.kind === "support" ? await videoSupport(data.info, data.settings)
      : await compressVideo(data.file, data.settings, value => scope.postMessage({ type: "progress", value }), value => scope.postMessage({ type: "phase", value }));
    scope.postMessage({ type: "done", result });
  } catch (error) { const message = error instanceof Error ? error.message : "Video processing failed."; scope.postMessage({ type: "error", message: data.kind === "compress" ? `${message} Try a lower resolution/bitrate or another output format/browser.` : message }); }
};
