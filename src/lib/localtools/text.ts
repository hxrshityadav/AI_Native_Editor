export type Cue = { text: string; start: number; end: number };
export function assertEnglishSpeech(text:string) {
  if(/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(text))throw new Error("This voice supports English text only. Use English wording; Hindi and other non-Latin scripts cannot be synthesized. Keep the original text for another reader.");
}
export function speechText(text: string): string {
  if (typeof text !== "string" || !text.trim() || text.length > 500) throw new Error("Use 1–500 characters per speech segment.");
  assertEnglishSpeech(text);
  return text.trim();
}
export function joinSpeech(segments: Float32Array[], maximumSeconds: number): Float32Array {
  const length = segments.reduce((sum, samples, index) => sum + samples.length + (index ? 1600 : 0), 0);
  if (!segments.length || !Number.isFinite(maximumSeconds) || maximumSeconds <= 0 || length > maximumSeconds * 16000 || segments.some(samples => !samples.length || samples.some(value => !Number.isFinite(value)))) throw new Error("Generated audio is invalid or too long. Select less text and retry.");
  const audio = new Float32Array(length); let offset = 0;
  segments.forEach((samples, index) => { if (index) offset += 1600; audio.set(samples, offset); offset += samples.length; });
  return audio;
}
export function validateCues(cues: Cue[], duration: number): Cue[] {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 120 || cues.length > 100) throw new Error("Use at most 100 segments in a two-minute recording.");
  let previous = 0;
  return cues.map(cue => {
    if (!cue.text.trim() || cue.text.length > 500 || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < previous || cue.end <= cue.start || cue.end > duration + 0.05) throw new Error("Segments need text and ordered, non-overlapping times inside the recording.");
    previous = cue.end; return { ...cue, text: speechText(cue.text), end: Math.min(duration, cue.end) };
  });
}
const stamp = (seconds: number, separator: string) => { const ms = Math.round(seconds * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2,"0")}:${String(Math.floor(ms / 60000) % 60).padStart(2,"0")}:${String(Math.floor(ms / 1000) % 60).padStart(2,"0")}${separator}${String(ms % 1000).padStart(3,"0")}`; };
export function subtitles(cues: Cue[], format: "srt" | "vtt") {
  return (format === "vtt" ? "WEBVTT\n\n" : "") + cues.map((cue, index) => `${format === "srt" ? `${index+1}\n` : ""}${stamp(cue.start, format === "srt" ? "," : ".")} --> ${stamp(cue.end, format === "srt" ? "," : ".")}\n${cue.text.replace(/-->/g,"→").replace(/[\r\n]+/g," ")}\n`).join("\n");
}
export function fitSpeech(audio: Float32Array, sampleRate: number, cues: Cue[], speech: Float32Array[]): Float32Array {
  const result = new Float32Array(audio.length);
  if (speech.length !== cues.length) throw new Error("The generated speech does not match the segments.");
  cues.forEach((cue, index) => {
    const start = Math.round(cue.start * sampleRate), available = Math.round((cue.end - cue.start) * sampleRate), samples = speech[index];
    if (!samples.length || samples.length > available * 1.5) throw new Error(`Segment ${index+1} is too long to fit naturally. Shorten its text and retry.`);
    const length = Math.min(available, samples.length), scale = samples.length / length;
    for (let i = 0; i < length && start+i < result.length; i++) { const at = i * scale, a = Math.floor(at), b = Math.min(a+1,samples.length-1), fade = Math.min(1, i/80, (length-i)/80); result[start+i] = (samples[a] * (1-at+a) + samples[b] * (at-a)) * fade; }
  }); return result;
}
