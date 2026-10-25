import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from "mediabunny";
import { FRAME_SEC, toDb } from "./silence";

/**
 * Measures 10 ms RMS levels (dBFS, mono) of an audio file by decoding it in streaming fashion:
 * memory stays at one level per frame (60,000 floats for 10 minutes), whatever the length.
 * Used on the speech audio the app already extracted, so the source video is not decoded again.
 */
export async function measureLevels(audio: Blob, onProgress?: (fraction: number) => void): Promise<Float32Array> {
  const input = new Input({ source: new BlobSource(audio), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("No audio track to analyse.");
    if (!(await track.canDecode())) throw new Error("This browser can't decode the speech audio.");
    const duration = await input.computeDuration();
    const frames = Math.max(1, Math.ceil(duration / FRAME_SEC));
    const sums = new Float64Array(frames);
    const counts = new Uint32Array(frames);
    let lastReport = -1;

    for await (const sample of new AudioSampleSink(track).samples()) {
      try {
        const n = sample.numberOfFrames;
        const channel = new Float32Array(n);
        const mono = new Float32Array(n);
        for (let c = 0; c < sample.numberOfChannels; c++) {
          sample.copyTo(channel, { planeIndex: c, format: "f32-planar" });
          for (let i = 0; i < n; i++) mono[i] += channel[i] / sample.numberOfChannels;
        }
        for (let i = 0; i < n; i++) {
          const t = sample.timestamp + i / sample.sampleRate;
          if (t < 0) continue;
          const f = Math.min(frames - 1, Math.floor(t / FRAME_SEC));
          sums[f] += mono[i] * mono[i];
          counts[f]++;
        }
        const progress = Math.min(1, (sample.timestamp + sample.duration) / duration);
        if (onProgress && progress - lastReport >= 0.01) {
          lastReport = progress;
          onProgress(progress);
        }
      } finally {
        sample.close();
      }
    }
    return Float32Array.from(sums, (s, i) => (counts[i] ? toDb(s / counts[i]) : -100));
  } finally {
    input.dispose();
  }
}
