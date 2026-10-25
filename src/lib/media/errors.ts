/** A failure as the user sees it: what happened and what to do next. */
export type Problem = { message: string; action: string };

/**
 * Turns a browser or media error from local processing into a Problem. Known
 * DOMException names get specific advice; anything else keeps the raw message
 * in brackets, which helps device reports without exposing content.
 */
export function describeMediaError(step: "extract" | "render", err: unknown): Problem {
  const name = err instanceof Error || err instanceof DOMException ? err.name : "";
  const raw = err instanceof Error || err instanceof DOMException ? err.message : String(err);

  if (name === "QuotaExceededError" || /quota/i.test(raw)) {
    return {
      message: "There isn't enough free storage on this device to save the video.",
      action: "Free up some space (old videos, downloads or unused apps), then try again.",
    };
  }
  if (name === "NotReadableError" || name === "NotFoundError") {
    return {
      message: "We lost access to the video file.",
      action: "Pick the video again. If it's in Google Drive or another cloud app, save it to your phone first.",
    };
  }
  if (name === "EncodingError" || name === "OperationError") {
    return {
      message: "This device's video processor stopped partway.",
      action: "Close other apps and tabs and try again. If it keeps happening, record at 1080p instead of 4K.",
    };
  }
  if (name === "NotSupportedError") {
    return {
      message: "This browser can't process this video.",
      action: "Use the latest Chrome, or re-export the video as H.264 MP4.",
    };
  }
  if (/caption font/i.test(raw)) {
    return { message: raw, action: "Check your connection and try again." };
  }
  return step === "extract"
    ? {
        message: `Couldn't extract the speech audio on this device (${raw || "unknown error"}).`,
        action: "Try again. If it keeps failing, use the latest Chrome or re-export the video with AAC audio.",
      }
    : {
        message: `The export failed (${raw || "unknown error"}).`,
        action: "Close other tabs and apps and try again. If it fails again, try a 1080p version.",
      };
}
