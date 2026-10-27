import { nativeMediaAvailable, extractAudioWavViaNative, NoAudioStreamError } from "./native-media-bridge";

export { NoAudioStreamError } from "./native-media-bridge";

export interface ExtractAudioProgressOptions {
  onProgress?: (progress: { phase?: string; progress: number }) => void;
}

// Desktop keeps its sidecar; browser extraction uses local WebCodecs/PCM conversion.
export async function extractAudioWav(
  file: File | Blob,
  audioTrackIndex = 0,
  options?: ExtractAudioProgressOptions,
): Promise<Blob> {
  if (nativeMediaAvailable()) {
    return extractAudioWavViaNative(file, audioTrackIndex);
  }
  const { Input, BlobSource, ALL_FORMATS, Output, BufferTarget, WavOutputFormat, Conversion } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const tracks = await input.getAudioTracks();
    const selected = Number.isInteger(audioTrackIndex) && audioTrackIndex >= 0 ? tracks[audioTrackIndex] : undefined;
    if (!selected) throw new NoAudioStreamError();
    if (!await selected.canDecode()) throw new Error("This browser cannot decode the selected audio stream. Convert it locally to AAC or try another browser.");
    const target = new BufferTarget();
    const output = new Output({ format: new WavOutputFormat(), target });
    const conversion = await Conversion.init({ input, output, video: { discard: true },
      audio: (track) => track.id === selected.id ? { codec: "pcm-s16", forceTranscode: true } : { discard: true } });
    if (!conversion.isValid) throw new Error("This audio stream cannot be converted locally. Try AAC audio or another browser.");
    conversion.onProgress = (progress) => options?.onProgress?.({ phase: "extracting", progress });
    await conversion.execute();
    if (!target.buffer) throw new Error("Audio extraction produced no output. Try another browser.");
    return new Blob([target.buffer], { type: "audio/wav" });
  } finally { input.dispose(); }
}
