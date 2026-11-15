/** Pure helpers for the zoomable waveform: visible window, peak reduction and keyboard nudging. */

export const MIN_VIEW_SECONDS = 0.5;
export const MIN_SELECTION = 0.1;
export type View = { start: number; end: number };

/** Highest zoom factor for a file: the visible window never gets shorter than half a second. */
export const maxZoom = (duration: number) => Math.max(1, duration / MIN_VIEW_SECONDS);

/** Visible window for a zoom factor and a requested start, kept inside the file. */
export function viewFor(duration: number, zoom: number, start: number): View {
  const span = duration / Math.min(Math.max(1, zoom), maxZoom(duration));
  const from = Math.min(Math.max(0, start), Math.max(0, duration - span));
  return { start: from, end: from + span };
}

/** Changes the zoom while keeping `anchor` (a time in seconds) at the same place on screen. */
export function zoomAround(duration: number, view: View, zoom: number, anchor: number): { zoom: number; view: View } {
  const next = Math.min(Math.max(1, zoom), maxZoom(duration)), span = view.end - view.start;
  const ratio = span > 0 ? (anchor - view.start) / span : 0;
  const nextSpan = duration / next;
  return { zoom: next, view: viewFor(duration, next, anchor - ratio * nextSpan) };
}

/**
 * Reduces evenly spaced fine peaks covering [fineStart, fineEnd] to `buckets` peaks for the visible window (maximum of
 * the fine values in each bucket). Returns null when the window holds fewer fine values than buckets, which means the
 * caller should ask the worker to decode that window at full resolution.
 */
export function reducePeaks(fine: ArrayLike<number>, fineStart: number, fineEnd: number, view: View, buckets: number): number[] | null {
  const span = fineEnd - fineStart;
  if (!(span > 0) || !fine.length || buckets < 1) return null;
  const perSecond = fine.length / span, first = (view.start - fineStart) * perSecond, last = (view.end - fineStart) * perSecond;
  if (first < -1e-6 || last > fine.length + 1e-6 || last - first < buckets) return null;
  const out = new Array<number>(buckets).fill(0), step = (last - first) / buckets;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(first + b * step), to = Math.max(from + 1, Math.ceil(first + (b + 1) * step));
    let max = 0;
    for (let i = from; i < Math.min(fine.length, to); i++) if (fine[i] > max) max = fine[i];
    out[b] = max;
  }
  return out;
}

/** Moves one edge of a selection by `delta` seconds without crossing the other edge or leaving the file. */
export function nudge(start: number, end: number, edge: "start" | "end", delta: number, duration: number): [number, number] {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  if (edge === "start") return [round(Math.min(Math.max(0, start + delta), end - MIN_SELECTION)), end];
  return [start, round(Math.max(Math.min(duration, end + delta), start + MIN_SELECTION))];
}

/** Arrow keys nudge by 0.1 s, Shift by 1 s and Alt by 0.01 s; PageUp/PageDown by 5 s. */
export function nudgeStep(key: string, shift: boolean, alt: boolean): number {
  const base = alt ? 0.01 : shift ? 1 : 0.1;
  if (key === "ArrowLeft" || key === "ArrowDown") return -base;
  if (key === "ArrowRight" || key === "ArrowUp") return base;
  if (key === "PageDown") return -5;
  if (key === "PageUp") return 5;
  return 0;
}
