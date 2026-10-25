export const MAX_VIDEO_DURATION_SECONDS = 600;

/** Only absorb machine rounding at the boundary, never a frame of extra video. */
const ROUNDING_EPSILON = Number.EPSILON * MAX_VIDEO_DURATION_SECONDS * 4;

export function validateVideoDuration(duration: unknown): duration is number {
  return typeof duration === "number" && Number.isFinite(duration) && duration > 0 &&
    duration <= MAX_VIDEO_DURATION_SECONDS + ROUNDING_EPSILON;
}

export function assertVideoDuration(duration: unknown): asserts duration is number {
  if (!validateVideoDuration(duration)) {
    throw new Error("Videos must have a readable duration and be 10 minutes or shorter. Choose another video to continue.");
  }
}
