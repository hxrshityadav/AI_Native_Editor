import type { TimedWord } from './transcript';
export type TimestampChunk = { text:string; timestamp:[number|null, number|null] };
/** No interpolation or positional transfer between model transcripts. Missing times are not word evidence. */
export function measuredWords(chunks:TimestampChunk[], duration:number, transcript?:string):TimedWord[]|undefined {
  if (!chunks.length || !Number.isFinite(duration) || duration <= 0) return;
  const words:TimedWord[] = [];
  let previous = 0;
  for (const chunk of chunks) {
    const text = chunk.text.trim(), [start,end] = chunk.timestamp;
    if (!text) continue;
    if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < previous || start < 0 || end <= start || end > duration || text.split(/\s+/).length !== 1) return;
    words.push({ text,start,end }); previous = end;
  }
  if(transcript !== undefined && transcript.trim().replace(/\s+/g,' ') !== words.map(word=>word.text).join(' ')) return;
  return words.length ? words : undefined;
}
