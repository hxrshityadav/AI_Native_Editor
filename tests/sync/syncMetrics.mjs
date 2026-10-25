// Caption-sync measurement (T-11): find where speech starts after each pause, straight from the
// audio, and compare with the start time of the caption word there. Pure functions; the CLI in
// sync-check.mjs feeds them ffmpeg-decoded audio and transcripts from /api/transcribe.

export const FRAME_SEC = 0.01;

/** Per-frame energy in dB for mono float samples (10 ms frames). */
export function frameEnergiesDb(samples, sampleRate) {
  const size = Math.round(sampleRate * FRAME_SEC);
  const out = [];
  for (let i = 0; i + size <= samples.length; i += size) {
    let sum = 0;
    for (let j = i; j < i + size; j++) sum += samples[j] * samples[j];
    out.push(10 * Math.log10(sum / size + 1e-12));
  }
  return out;
}

/**
 * Speech regions from frame energies. Threshold = noise floor (10th percentile) + `marginDb`.
 * Gaps shorter than `minSilenceSec` are bridged, regions shorter than `minSpeechSec` dropped,
 * so only pause-separated phrases remain.
 */
export function speechRegions(energiesDb, { marginDb = 12, minSilenceSec = 0.25, minSpeechSec = 0.12 } = {}) {
  const sorted = [...energiesDb].sort((a, b) => a - b);
  const floorDb = sorted[Math.floor(sorted.length * 0.1)] ?? -120;
  const peakDb = sorted[Math.floor(sorted.length * 0.98)] ?? floorDb;
  const threshold = floorDb + marginDb;

  const raw = [];
  let start = -1;
  energiesDb.forEach((e, i) => {
    if (e > threshold && start < 0) start = i;
    if (e <= threshold && start >= 0) {
      raw.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) raw.push([start, energiesDb.length]);

  const merged = [];
  for (const r of raw) {
    const last = merged.at(-1);
    if (last && (r[0] - last[1]) * FRAME_SEC < minSilenceSec) last[1] = r[1];
    else merged.push([...r]);
  }
  const regions = merged
    .filter(([a, b]) => (b - a) * FRAME_SEC >= minSpeechSec)
    .map(([a, b]) => ({ start: a * FRAME_SEC, end: b * FRAME_SEC }));
  return { regions, floorDb, snrDb: peakDb - floorDb };
}

/**
 * Pairs each speech onset with the nearest phrase-initial caption word within `windowSec`.
 * Error is word start minus speech onset: positive means the caption comes late.
 *
 * Only words that start a phrase (first word, or after a ≥ `gapSec` gap in the word timings)
 * are candidates. Matching any word would let a caption that is early by more than one word's
 * length pair with the next word instead, hiding the error.
 */
export function onsetErrors(regions, words, windowSec = 0.6, gapSec = 0.15) {
  const initial = words.filter((w, i) => i === 0 || w.start - words[i - 1].end >= gapSec);
  const errors = [];
  for (const r of regions) {
    let best = null;
    for (const w of initial) {
      const d = w.start - r.start;
      if (Math.abs(d) <= windowSec && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
    if (best !== null) errors.push(best);
  }
  return errors;
}

export function summarize(errors, toleranceSec = 0.15) {
  if (errors.length === 0) return { phrases: 0, within: 0, medianAbsMs: null, p90AbsMs: null, biasMs: null };
  const abs = errors.map(Math.abs).sort((a, b) => a - b);
  const pick = (q) => abs[Math.min(abs.length - 1, Math.floor(q * abs.length))];
  return {
    phrases: errors.length,
    within: errors.filter((e) => Math.abs(e) <= toleranceSec + 1e-9).length / errors.length,
    medianAbsMs: Math.round(pick(0.5) * 1000),
    p90AbsMs: Math.round(pick(0.9) * 1000),
    biasMs: Math.round((errors.reduce((a, b) => a + b, 0) / errors.length) * 1000),
  };
}
