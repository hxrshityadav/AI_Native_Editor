import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from "mediabunny";
import { detectSilences, type EnergyWindow, type SilenceOptions } from "../editor/timeline";

const scope = self as unknown as { onmessage: ((event: MessageEvent<{ audio: Blob; options: SilenceOptions }>) => void) | null; postMessage: (value: unknown) => void };
scope.onmessage = async ({ data: { audio, options } }) => {
  const input = new Input({ source: new BlobSource(audio), formats: ALL_FORMATS });
  try {
    const duration = await input.computeDuration();
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("No speech audio to analyze. Re-extract the audio and try again.");
    const windows: EnergyWindow[] = [];
    const sink = new AudioSampleSink(track);
    let lastPercent = -1;
    for await (const sample of sink.samples()) {
      try {
        const data = new Float32Array(sample.numberOfFrames * sample.numberOfChannels);
        sample.copyTo(data, { planeIndex: 0, format: "f32" });
        const step = Math.max(1, Math.round(sample.sampleRate * 0.02));
        for (let first = 0; first < sample.numberOfFrames; first += step) {
          const last = Math.min(sample.numberOfFrames, first + step);
          let energy = 0;
          for (let i = first * sample.numberOfChannels; i < last * sample.numberOfChannels; i++) energy += data[i] ** 2;
          const rms = Math.sqrt(energy / ((last - first) * sample.numberOfChannels));
          windows.push({ start: Math.max(0, sample.timestamp + first / sample.sampleRate),
            end: sample.timestamp + last / sample.sampleRate, db: 20 * Math.log10(Math.max(1e-8, rms)) });
        }
        const percent = Math.min(100, Math.floor((sample.timestamp + sample.duration) / duration * 100));
        if (percent !== lastPercent) { lastPercent = percent; scope.postMessage({ type: "progress", value: percent / 100 }); }
      } finally { sample.close(); }
    }
    scope.postMessage({ type: "done", cuts: detectSilences(windows, options), windows });
  } catch { scope.postMessage({ type: "error", message: "Couldn't decode the speech audio for silence analysis. Retry extraction or try the latest Chrome." }); }
  finally { input.dispose(); }
};
