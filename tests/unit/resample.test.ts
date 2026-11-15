import { describe, expect, it } from "vitest";
import { StreamingResampler, resampleMono } from "@/lib/localtools/dsp";

// Speech audio is resampled to 16 kHz mono before Whisper. These checks guard against the audio being shortened,
// sped up or distorted, which would also wreck recognition.
describe("speech resampling to 16 kHz", () => {
  const tone = (rate: number, seconds: number, hz: number) => Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => 0.5 * Math.sin(2 * Math.PI * hz * i / rate));
  const crossings = (x: Float32Array) => { let n = 0; for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) n++; return n; };
  it.each([44100, 48000, 22050, 16000])("keeps duration and pitch from %i Hz", rate => {
    const out = resampleMono([tone(rate, 2, 440)], rate);
    expect(Math.abs(out.length - 32000)).toBeLessThanOrEqual(1);
    expect(Math.abs(crossings(out) - 880)).toBeLessThanOrEqual(2);
    expect(Math.max(...out)).toBeGreaterThan(0.45);
  });
  it("mixes stereo to mono without clipping", () => { const left = tone(48000, 1, 300), right = tone(48000, 1, 300); expect(Math.max(...resampleMono([left, right], 48000))).toBeLessThanOrEqual(0.5); });
  it("streaming in decoder-sized chunks matches resampling the whole file, with no gaps", () => {
    const rate = 44100, input = tone(rate, 1, 440), whole = resampleMono([input], rate), resampler = new StreamingResampler(rate), parts: Float32Array[] = [];
    for (let start = 0; start < input.length; start += 1152) parts.push(resampler.push(input.subarray(start, start + 1152)));
    parts.push(resampler.push(new Float32Array(0), true));
    const streamed = new Float32Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { streamed.set(p, o); o += p.length; }
    expect(Math.abs(streamed.length - whole.length)).toBeLessThanOrEqual(1);
    let diff = 0; for (let i = 0; i < Math.min(whole.length, streamed.length); i++) diff = Math.max(diff, Math.abs(whole[i] - streamed[i]));
    expect(diff).toBeLessThan(1e-5);
  });
});
