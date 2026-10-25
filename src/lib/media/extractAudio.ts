import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  OggOutputFormat,
  Output,
  Quality,
} from "mediabunny";
import { assertVideoDuration } from "./duration";
import { probeFile } from "./probe";
import { discardOpusPadding } from "./opusPadding";

export const SPEECH_AUDIO = {
  codec: "opus",
  channels: 1,
  sampleRate: 48000,
  bitrate: 32_000,
  mimeType: "audio/ogg",
} as const;

export class ExtractionError extends Error {
  override name = "ExtractionError";
}

/**
 * Re-encodes the primary audio track as mono Opus in Ogg, the smallest format
 * every supported transcription provider accepts. Runs entirely on-device.
 *
 * First through WebCodecs. If that fails (on Android the AAC decoder behind WebCodecs is the
 * phone's own, and it can fail on some recordings or while the 4K preview holds the hardware),
 * the audio is decoded a second way, through Web Audio, before giving up.
 */
export async function extractSpeechAudio(file: Blob, onProgress?: (fraction: number) => void): Promise<Blob> {
  const duration = (await probeFile(file)).durationSec;
  assertVideoDuration(duration);
  try {
    return await extractWithWebCodecs(file, duration, onProgress);
  } catch (first) {
    if (isFileAccessError(first)) throw first; // the file itself is gone; a second decoder won't help
    onProgress?.(0);
    try {
      return await extractWithWebAudio(file, duration, onProgress);
    } catch (second) {
      throw new ExtractionError(`WebCodecs: ${label(first)}; Web Audio: ${label(second)}`);
    }
  }
}

async function extractWithWebCodecs(file: Blob, duration: number, onProgress?: (fraction: number) => void): Promise<Blob> {
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
    return toBlob(output.target.buffer, duration);
  } finally {
    input.dispose();
  }
}

/** Copies the audio track out (no decoding), decodes it with Web Audio, then encodes Opus. */
async function extractWithWebAudio(file: Blob, duration: number, onProgress?: (fraction: number) => void): Promise<Blob> {
  // 1. Audio only, packets copied: a few MB even for a 3-minute 4K recording.
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const audioOnly = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  try {
    const copy = await Conversion.init({
      input,
      output: audioOnly,
      tracks: "primary",
      video: { discard: true },
      tags: {},
      showWarnings: false,
    });
    if (!copy.isValid || !copy.utilizedTracks.some((t) => t.type === "audio")) {
      throw new ExtractionError("Audio track could not be copied.");
    }
    await copy.execute();
  } finally {
    input.dispose();
  }
  const m4a = audioOnly.target.buffer;
  if (!m4a) throw new ExtractionError("Audio copy produced no data.");
  onProgress?.(0.2);

  // 2. Decode at 48 kHz and mix down to mono.
  const decoded = await new OfflineAudioContext(1, 1, SPEECH_AUDIO.sampleRate).decodeAudioData(m4a);
  const mono = new Float32Array(decoded.length);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const channel = decoded.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels;
  }
  onProgress?.(0.4);

  // 3. Encode Opus in one-second samples.
  const output = new Output({ format: new OggOutputFormat(), target: new BufferTarget() });
  const source = new AudioSampleSource({ codec: SPEECH_AUDIO.codec, quality: new Quality({ bitrate: SPEECH_AUDIO.bitrate }) });
  output.addAudioTrack(source);
  await output.start();
  const step = SPEECH_AUDIO.sampleRate;
  for (let i = 0; i < mono.length; i += step) {
    const sample = new AudioSample({
      // A copy, not a subarray: the sample must not read from the start of the shared buffer.
      data: mono.slice(i, i + step),
      format: "f32",
      numberOfChannels: 1,
      sampleRate: SPEECH_AUDIO.sampleRate,
      timestamp: i / SPEECH_AUDIO.sampleRate,
    });
    await source.add(sample);
    sample.close();
    onProgress?.(0.4 + 0.6 * Math.min(1, (i + step) / mono.length));
  }
  await output.finalize();
  return toBlob(output.target.buffer, duration);
}

function toBlob(buffer: ArrayBuffer | null, duration: number): Blob {
  if (!buffer || buffer.byteLength === 0) throw new ExtractionError("Audio extraction produced no data.");
  discardOpusPadding(buffer, duration);
  return new Blob([buffer], { type: SPEECH_AUDIO.mimeType });
}

function isFileAccessError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "NotReadableError" || err.name === "NotFoundError");
}

/** Error name only (for the device report); messages could in theory carry file details. */
function label(err: unknown): string {
  return err instanceof Error || err instanceof DOMException ? err.name : "unknown";
}
