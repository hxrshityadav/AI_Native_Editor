import { describe, expect, it } from "vitest";
import { DEFAULT_SILENCE_SETTINGS, detectSilence, frameLevelsDb, levelStats, type SilenceSettings } from "@/lib/edit/silence";
import { buildTimeMap } from "@/lib/edit/timeline";

const RATE = 16000;

/** Deterministic noise: `loudness` 0..1 for each [start, end, level] span, `bed` elsewhere. */
function audio(totalSec: number, spans: [number, number, number][], bed = 0.001) {
  const out = new Float32Array(Math.round(totalSec * RATE));
  let seed = 3;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const span = spans.find(([a, b]) => t >= a && t < b);
    out[i] = rand() * (span ? span[2] : bed);
  }
  return frameLevelsDb(out, RATE);
}

const detect = (levels: Float32Array, total: number, settings: Partial<SilenceSettings> = {}) =>
  detectSilence(levels, total, { ...DEFAULT_SILENCE_SETTINGS, ...settings });

describe("silence detection", () => {
  it("suggests nothing when there is no silence", () => {
    const levels = audio(10, [[0, 10, 0.3]]);
    expect(detect(levels, 10).intervals).toEqual([]);
  });

  it("finds long silences and keeps padding around speech", () => {
    // speech 0–2, silence 2–5, speech 5–8
    const d = detect(audio(8, [[0, 2, 0.3], [5, 8, 0.3]]), 8);
    expect(d.intervals).toHaveLength(1);
    const [cut] = d.intervals;
    expect(cut.start).toBeCloseTo(2 + DEFAULT_SILENCE_SETTINGS.keepAfterSpeechSec, 1);
    expect(cut.end).toBeCloseTo(5 - DEFAULT_SILENCE_SETTINGS.keepBeforeSpeechSec, 1);
    expect(cut).toMatchObject({ action: "remove", origin: "silence" });
  });

  it("keeps ordinary short pauses", () => {
    // 0.3 s pauses between phrases: natural speech rhythm
    const spans: [number, number, number][] = [[0, 1, 0.3], [1.3, 2.5, 0.3], [2.8, 4, 0.3]];
    expect(detect(audio(4, spans), 4).intervals).toEqual([]);
  });

  it("only long pauses mode skips medium pauses", () => {
    // pauses of 0.8 s and 2 s
    const levels = audio(8, [[0, 1, 0.3], [1.8, 3, 0.3], [5, 8, 0.3]]);
    expect(detect(levels, 8).intervals).toHaveLength(2);
    expect(detect(levels, 8, { mode: "long" }).intervals).toHaveLength(1);
  });

  it("never shortens a pause below the minimum retained pause", () => {
    const d = detect(audio(8, [[0, 2, 0.3], [5, 8, 0.3]]), 8, { keepAfterSpeechSec: 0, keepBeforeSpeechSec: 0, minPauseSec: 0.4 });
    const kept = 3 - (d.intervals[0].end - d.intervals[0].start);
    expect(kept).toBeGreaterThanOrEqual(0.39);
  });

  it("keeps quiet speech: the auto threshold follows the clip's own floor", () => {
    // speech at about -45 dBFS over a -75 dBFS floor
    const levels = audio(8, [[0, 2, 0.008], [5, 8, 0.008]], 0.0002);
    const d = detect(levels, 8);
    expect(d.intervals).toHaveLength(1);
    expect(d.intervals[0].end - d.intervals[0].start).toBeLessThan(3);
  });

  it("keeps background music: the auto threshold never rises above -40 dBFS", () => {
    // speech pauses filled by music at about -33 dBFS
    const levels = audio(8, [[0, 2, 0.3], [5, 8, 0.3]], 0.03);
    expect(levelStats(levels).autoThresholdDb).toBe(-40);
    expect(detect(levels, 8).intervals).toEqual([]);
    // ...unless the user raises the threshold on purpose
    expect(detect(levels, 8, { thresholdDb: -25 }).intervals).toHaveLength(1);
  });

  it("ignores a click inside a silence", () => {
    const levels = audio(8, [[0, 2, 0.3], [3.5, 3.55, 0.5], [5, 8, 0.3]]);
    expect(detect(levels, 8).intervals).toHaveLength(1);
  });

  it("cuts silence at the start and end without padding outside speech", () => {
    const d = detect(audio(10, [[2, 8, 0.3]]), 10);
    expect(d.intervals).toHaveLength(2);
    expect(d.intervals[0].start).toBe(0);
    expect(d.intervals[0].end).toBeCloseTo(2 - DEFAULT_SILENCE_SETTINGS.keepBeforeSpeechSec, 1);
    expect(d.intervals[1].end).toBe(10);
  });

  it("finds several separate silences, and their time map adds up", () => {
    const d = detect(audio(14, [[0, 2, 0.3], [4, 6, 0.3], [9, 11, 0.3], [12.5, 14, 0.3]]), 14);
    expect(d.intervals).toHaveLength(3);
    const map = buildTimeMap(14, { version: 1, intervals: d.intervals });
    const removed = d.intervals.reduce((n, i) => n + i.end - i.start, 0);
    expect(map.outputDuration).toBeCloseTo(14 - removed, 3);
  });
});
