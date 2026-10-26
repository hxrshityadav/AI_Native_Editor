import { detectSilences } from "../../../../../../src/lib/editor/timeline";
self.onmessage = (event: MessageEvent<{ channels: Float32Array[]; sampleRate: number; inPoint: number; outPoint: number; threshold: number; minimum: number; padding: number }>) => {
  const { channels, sampleRate, inPoint, outPoint, threshold, minimum, padding } = event.data;
  const windows = [];
  const size = Math.max(1, Math.round(sampleRate * 0.02));
  const end = Math.min(channels[0]?.length ?? 0, Math.floor(outPoint * sampleRate));
  for (let offset = Math.floor(inPoint * sampleRate); offset < end; offset += size) {
    let sum = 0, count = 0;
    for (const channel of channels) for (let i = offset; i < Math.min(offset + size, end); i++) { sum += channel[i] ** 2; count++; }
    windows.push({ start: offset / sampleRate, end: Math.min(offset + size, end) / sampleRate, db: 20 * Math.log10(Math.max(1e-8, Math.sqrt(sum / Math.max(1, count)))) });
  }
  self.postMessage(detectSilences(windows, { threshold, minimum, padding, keep: 0.1 }));
};
