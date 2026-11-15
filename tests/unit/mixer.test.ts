import { describe, expect, it } from "vitest";
import { DEFAULT_MIX, MIX_WINDOW, StereoResampler, detectSpeech, duckingCurve, fadeEdges, validateMixOptions } from "@/lib/mediatools/mixer";

const levels = (pattern: [db: number, seconds: number][]) => Float32Array.from(pattern.flatMap(([db, seconds]) => Array(Math.round(seconds / MIX_WINDOW)).fill(db)));
const at = (seconds: number) => Math.round(seconds / MIX_WINDOW);

describe("speech detection", () => {
  it("finds speech above the noise floor with pre-roll and hold", () => {
    const speech = detectSpeech(levels([[-60, 2], [-25, 1], [-60, 2]]));
    expect(speech[at(1)]).toBe(0);
    expect(speech[at(2.5)]).toBe(1);
    expect(speech[at(2) - 3]).toBe(1); // 120 ms pre-roll
    expect(speech[at(3) + 10]).toBe(1); // within the 350 ms hold
    expect(speech[at(4)]).toBe(0);
  });
  it("adapts to a noisy floor instead of treating noise as speech", () => {
    const speech = detectSpeech(levels([[-35, 3], [-15, 1], [-35, 3]]));
    expect(speech[at(1)]).toBe(0);
    expect(speech[at(3.5)]).toBe(1);
  });
  it("handles empty and silent input", () => {
    expect(detectSpeech(new Float32Array(0)).length).toBe(0);
    expect(detectSpeech(levels([[-90, 1]])).every(v => v === 0)).toBe(true);
  });
});

describe("ducking curve", () => {
  const speech = detectSpeech(levels([[-60, 2], [-25, 2], [-60, 3]]));
  const gains = duckingCurve(speech, 12);
  it("stays at unity without speech", () => { expect(gains[at(1)]).toBeCloseTo(1, 5); });
  it("reaches the chosen depth during speech", () => { expect(20 * Math.log10(gains[at(3.5)])).toBeCloseTo(-12, 1); });
  it("attacks faster than it releases", () => {
    const start = at(2) - 6, end = at(4) + 18; // detected speech edges, including pre-roll and hold
    const down = 20 * Math.log10(gains[start + 5]), up = 20 * Math.log10(gains[end + 5]);
    expect(down).toBeLessThan(-9); // 100 ms into the attack: mostly down
    expect(up).toBeLessThan(-3); // 100 ms into the release: still well down
    expect(gains[at(6.5)]).toBeGreaterThan(0.95); // recovered after the release
  });
  it("changes smoothly (no step larger than 4 dB per 20 ms window; samples are interpolated between windows)", () => {
    for (let i = 1; i < gains.length; i++) expect(Math.abs(20 * Math.log10(gains[i] / gains[i - 1]))).toBeLessThan(4);
  });
});

describe("stereo resampler", () => {
  it("keeps length and a sine's frequency when converting 44.1 kHz to 48 kHz", () => {
    const rate = 44100, seconds = 1, frames = rate * seconds, tone = 1000;
    const left = Float32Array.from({ length: frames }, (_, i) => 0.5 * Math.sin(2 * Math.PI * tone * i / rate));
    const resampler = new StereoResampler(rate, 48000 * seconds);
    for (let i = 0; i < frames; i += 1024) resampler.push(left.subarray(i, i + 1024), left.subarray(i, i + 1024));
    expect(resampler.written).toBeGreaterThan(47990);
    let crossings = 0;
    for (let i = 1; i < resampler.written; i++) if (resampler.out[(i - 1) * 2] < 0 && resampler.out[i * 2] >= 0) crossings++;
    expect(crossings).toBeGreaterThanOrEqual(998); expect(crossings).toBeLessThanOrEqual(1001);
    expect(Math.max(...Array.from(resampler.out.subarray(0, 4000)))).toBeLessThanOrEqual(16384);
  });
  it("stops at its capacity", () => {
    const resampler = new StereoResampler(48000, 100), chunk = new Float32Array(500).fill(0.1);
    expect(resampler.push(chunk, chunk)).toBe(false);
    expect(resampler.written).toBe(100);
  });
});

describe("loop seams and options", () => {
  it("fades both edges of a looped segment to silence", () => {
    const buffer = new Int16Array(2000).fill(10000);
    fadeEdges(buffer, 1000, 100);
    expect(buffer[0]).toBe(0); expect(buffer[1998]).toBeLessThan(100); expect(buffer[1000]).toBe(10000);
  });
  it("rejects out-of-range settings with a reason", () => {
    expect(() => validateMixOptions(DEFAULT_MIX)).not.toThrow();
    expect(() => validateMixOptions({ ...DEFAULT_MIX, musicGainDb: 6 })).toThrow(/music level/);
    expect(() => validateMixOptions({ ...DEFAULT_MIX, duckDepthDb: 50 })).toThrow(/ducking depth/);
    expect(() => validateMixOptions({ ...DEFAULT_MIX, musicOffset: -1 })).toThrow(/music start/);
  });
});
