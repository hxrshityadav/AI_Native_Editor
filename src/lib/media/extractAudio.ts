import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, OggOutputFormat, Output, Quality } from "mediabunny";

export const SPEECH_AUDIO = {
  codec: "opus",
  channels: 1,
  sampleRate: 48000,
  bitrate: 32_000,
  mimeType: "audio/ogg",
} as const;

export class ExtractionError extends Error {}

/**
 * Re-encodes the primary audio track as mono Opus in Ogg, the smallest format
 * every supported transcription provider accepts. Runs entirely on-device.
 */
export async function extractSpeechAudio(
  file: Blob,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: new OggOutputFormat(), target: new BufferTarget() });
  try {
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { discard: true },
      audio: {
        codec: SPEECH_AUDIO.codec,
        numberOfChannels: SPEECH_AUDIO.channels,
        sampleRate: SPEECH_AUDIO.sampleRate,
        quality: new Quality({ bitrate: SPEECH_AUDIO.bitrate }),
        forceTranscode: true,
      },
      tags: {},
      showWarnings: false,
    });
    const audioKept = conversion.utilizedTracks.some((t) => t.type === "audio");
    if (!conversion.isValid || !audioKept) {
      const reason = conversion.discardedTracks.find((d) => d.track.type === "audio")?.reason ?? "unknown";
      throw new ExtractionError(`Audio track could not be converted (${reason}).`);
    }
    if (onProgress) conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0) throw new ExtractionError("Audio extraction produced no data.");
    return new Blob([buffer], { type: SPEECH_AUDIO.mimeType });
  } finally {
    input.dispose();
  }
}
