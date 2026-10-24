import type { CaptionLine } from "./types";

/** Formats seconds as an SRT timestamp, e.g. 00:01:02,345. */
export function formatSrtTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

export function toSrt(lines: readonly CaptionLine[]): string {
  return lines
    .map((line, i) => `${i + 1}\n${formatSrtTime(line.start)} --> ${formatSrtTime(line.end)}\n${line.text}\n`)
    .join("\n");
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}
