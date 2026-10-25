import { z } from "zod";
import type { EditInterval } from "./timeline";

/**
 * Silence suggestions from measured audio levels. Pure: the levels come from audioLevels.worker.ts.
 * Suggestions are only suggestions: the user reviews each one before anything is cut.
 */

/** Level frame length. */
export const FRAME_SEC = 0.01;

export const silenceSettingsSchema = z.object({
  /** dBFS below which audio counts as silence; "auto" derives it from this clip's levels. */
  thresholdDb: z.union([z.literal("auto"), z.number().min(-80).max(-10)]),
  /** Quiet stretches shorter than this are ordinary pauses and are never suggested. */
  minSilenceSec: z.number().min(0.2).max(10),
  /** Silence kept after speech stops, so words don't end abruptly. */
  keepAfterSpeechSec: z.number().min(0).max(1),
  /** Silence kept before speech starts again, so breaths and first syllables survive. */
  keepBeforeSpeechSec: z.number().min(0).max(1),
  /** A pause between sentences never becomes shorter than this. */
  minPauseSec: z.number().min(0).max(2),
  /** "long" suggests only pauses of at least longPauseSec. */
  mode: z.enum(["all", "long"]),
  longPauseSec: z.number().min(0.5).max(10),
});
export type SilenceSettings = z.infer<typeof silenceSettingsSchema>;

export const DEFAULT_SILENCE_SETTINGS: SilenceSettings = {
  thresholdDb: "auto",
  minSilenceSec: 0.6,
  keepAfterSpeechSec: 0.15,
  keepBeforeSpeechSec: 0.1,
  minPauseSec: 0.25,
  mode: "all",
  longPauseSec: 1.5,
};

/** Loud stretches shorter than this inside silence are clicks or bumps, not speech. */
const MIN_SOUND_SEC = 0.08;
/** Suggested cuts shorter than this aren't worth a jump cut. */
const MIN_CUT_SEC = 0.1;
/**
 * The auto threshold never goes above this: anything louder (background music, a fan, quiet
 * speech in a loud room) is kept unless the user raises the threshold themselves.
 */
const AUTO_MAX_DB = -40;
const AUTO_MIN_DB = -65;

/** Per-frame RMS level in dBFS of mono float samples. */
export function frameLevelsDb(samples: Float32Array, sampleRate: number): Float32Array {
  const size = Math.round(sampleRate * FRAME_SEC);
  const out = new Float32Array(Math.floor(samples.length / size));
  for (let f = 0; f < out.length; f++) {
    let sum = 0;
    for (let i = f * size; i < (f + 1) * size; i++) sum += samples[i] * samples[i];
    out[f] = toDb(sum / size);
  }
  return out;
}

export function toDb(meanSquare: number): number {
  return Math.max(-100, 10 * Math.log10(meanSquare + 1e-10));
}

export type LevelStats = {
  /** Typical quiet level (10th percentile). */
  floorDb: number;
  /** Typical loud level (95th percentile). */
  speechDb: number;
  /** What "auto" uses: a third of the way from the floor to speech, within [-65, -40] dBFS. */
  autoThresholdDb: number;
};

export function levelStats(levels: Float32Array): LevelStats {
  const sorted = Float32Array.from(levels).sort();
  const pick = (q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : -100);
  const floorDb = pick(0.1);
  const speechDb = pick(0.95);
  const auto = Math.min(AUTO_MAX_DB, Math.max(AUTO_MIN_DB, floorDb + (speechDb - floorDb) / 3));
  return { floorDb: round1(floorDb), speechDb: round1(speechDb), autoThresholdDb: round1(auto) };
}

export type SilenceDetection = {
  thresholdDb: number;
  stats: LevelStats;
  /** Every quiet stretch long enough to suggest, before padding (for the timeline). */
  silences: { start: number; end: number }[];
  /** Suggested cuts, after the speech padding and pause rules. */
  intervals: EditInterval[];
};

export function detectSilence(levels: Float32Array, durationSec: number, settings: SilenceSettings): SilenceDetection {
  const stats = levelStats(levels);
  const thresholdDb = settings.thresholdDb === "auto" ? stats.autoThresholdDb : settings.thresholdDb;
  const minSilence = settings.mode === "long" ? Math.max(settings.minSilenceSec, settings.longPauseSec) : settings.minSilenceSec;

  // Runs of quiet frames; brief sounds inside quiet (clicks, a bump) don't break a silence.
  const quiet = Array.from(levels, (l) => l <= thresholdDb);
  const blip = Math.round(MIN_SOUND_SEC / FRAME_SEC);
  for (let i = 0; i < quiet.length; ) {
    if (quiet[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < quiet.length && !quiet[j]) j++;
    const bounded = i > 0 && j < quiet.length;
    if (bounded && j - i < blip) quiet.fill(true, i, j);
    i = j;
  }

  const silences: { start: number; end: number }[] = [];
  for (let i = 0; i < quiet.length; ) {
    if (!quiet[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < quiet.length && quiet[j]) j++;
    const start = i * FRAME_SEC;
    const end = j === quiet.length ? durationSec : j * FRAME_SEC;
    if (end - start >= minSilence) silences.push({ start: round3(start), end: round3(Math.min(end, durationSec)) });
    i = j;
  }

  const intervals: EditInterval[] = [];
  for (const s of silences) {
    const atStart = s.start <= FRAME_SEC;
    const atEnd = s.end >= durationSec - FRAME_SEC;
    let after = atStart ? 0 : settings.keepAfterSpeechSec;
    let before = atEnd ? 0 : settings.keepBeforeSpeechSec;
    if (!atStart && !atEnd && after + before < settings.minPauseSec) {
      const extra = (settings.minPauseSec - after - before) / 2;
      after += extra;
      before += extra;
    }
    const start = s.start + after;
    const end = s.end - before;
    if (end - start >= MIN_CUT_SEC) intervals.push({ start: round3(start), end: round3(end), action: "remove", origin: "silence" });
  }
  return { thresholdDb, stats, silences, intervals };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
