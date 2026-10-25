import { describe, expect, it } from "vitest";
import { frameEnergiesDb, onsetErrors, speechRegions, summarize } from "../sync/syncMetrics.mjs";

const RATE = 16000;

/** Quiet noise with loud noise bursts at the given [start, end] seconds (deterministic). */
function signal(totalSec: number, bursts: [number, number][]) {
  const out = new Float32Array(Math.round(totalSec * RATE));
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const loud = bursts.some(([a, b]) => t >= a && t < b);
    out[i] = rand() * (loud ? 0.3 : 0.003);
  }
  return out;
}

describe("speech onset detection", () => {
  const bursts: [number, number][] = [
    [0.5, 1.4],
    [2.0, 2.9],
    [3.6, 4.1],
  ];
  const { regions, snrDb } = speechRegions(frameEnergiesDb(signal(5, bursts), RATE));

  it("finds each pause-separated phrase within 10 ms", () => {
    expect(regions).toHaveLength(3);
    regions.forEach((r: { start: number }, i: number) => expect(Math.abs(r.start - bursts[i][0])).toBeLessThanOrEqual(0.01));
  });

  it("reports a high signal-to-noise ratio for a clean signal", () => {
    expect(snrDb).toBeGreaterThan(30);
  });

  it("bridges short gaps inside a phrase", () => {
    const { regions: joined } = speechRegions(frameEnergiesDb(signal(3, [[0.5, 1.0], [1.1, 1.5]]), RATE));
    expect(joined).toHaveLength(1);
  });
});

describe("onset errors and summary", () => {
  const regions = [{ start: 1, end: 2 }, { start: 3, end: 4 }, { start: 5, end: 6 }];
  const words = (shift: number) => regions.flatMap((r) => [
    { start: r.start + shift, end: r.start + shift + 0.3 },
    { start: r.start + shift + 0.35, end: r.start + shift + 0.6 },
  ]);

  it("recovers a known caption delay as bias", () => {
    const s = summarize(onsetErrors(regions, words(0.1)));
    expect(s).toMatchObject({ phrases: 3, biasMs: 100, medianAbsMs: 100, within: 1 });
  });

  it("marks a 200 ms early caption as out of tolerance", () => {
    const s = summarize(onsetErrors(regions, words(-0.2)));
    expect(s).toMatchObject({ biasMs: -200, within: 0 });
  });

  it("ignores onsets with no caption word nearby", () => {
    expect(onsetErrors(regions, [{ start: 1.05, end: 1.3 }])).toHaveLength(1);
  });

  it("handles no data", () => {
    expect(summarize([])).toMatchObject({ phrases: 0, medianAbsMs: null });
  });
});
