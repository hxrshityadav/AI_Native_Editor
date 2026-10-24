import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import type { ProbeResult } from "./types";

export class UnreadableFileError extends Error {}

/** Reads container and track metadata from a local file. Nothing leaves the device. */
export async function probeFile(file: Blob): Promise<ProbeResult> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    if (!(await input.canRead())) throw new UnreadableFileError("Unsupported container");

    const [videoTrack, audioTrack] = await Promise.all([
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
    ]);

    return {
      fileSizeBytes: file.size,
      mimeType: await input.getMimeType(),
      durationSec: await input.computeDuration(),
      video: videoTrack
        ? {
            codec: await videoTrack.getCodec(),
            width: await videoTrack.getDisplayWidth(),
            height: await videoTrack.getDisplayHeight(),
            rotation: await videoTrack.getRotation(),
            canDecode: await videoTrack.canDecode(),
          }
        : null,
      audio: audioTrack
        ? {
            codec: await audioTrack.getCodec(),
            channels: await audioTrack.getNumberOfChannels(),
            sampleRate: await audioTrack.getSampleRate(),
            canDecode: await audioTrack.canDecode(),
          }
        : null,
    };
  } catch (err) {
    if (err instanceof UnreadableFileError) throw err;
    throw new UnreadableFileError(err instanceof Error ? err.message : "Unreadable file");
  } finally {
    input.dispose();
  }
}
