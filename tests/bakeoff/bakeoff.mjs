// Hinglish bake-off (T-12): the same clips through each provider via our real /api/transcribe, scored
// for text accuracy (against your reference transcripts), script, caption sync and speed.
//
//   npm run bakeoff -- <clip files or a folder> [--providers=groq,sarvam] [--seconds=30] [--language=hinglish]
//
// Next to each clip, optional:
//   <clip>.ref.txt    what was actually said, typed in Roman Hinglish (needed for accuracy scores)
//   <clip>.edits.txt  Instagram Edits' captions for the same clip, typed or pasted (text only)
// Needs `npm run build`, ffmpeg, and provider keys in .env.local (see .env.example). Each clip is cut to
// --seconds (default 30, Sarvam's REST limit) so every provider hears the same audio. Calls are billable.
// Transcripts land in tests/bakeoff/.out (gitignored): don't commit or share them.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { ff, ROOT, startServer, stopServer } from "../e2e/helpers.mjs";
import { frameEnergiesDb, onsetErrors, speechRegions, summarize } from "../sync/syncMetrics.mjs";
import { devanagariShare, editDistance, lenientChars, words } from "./textMetrics.mjs";

const OUT = join(ROOT, "tests/bakeoff/.out");
const PORT = 3121;
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const PROVIDERS = arg("providers", "groq,sarvam").split(",");
const SECONDS = Number(arg("seconds", "30"));
const LANGUAGE = arg("language", "hinglish");
/** List prices (docs/research/README.md, checked 2026-10-25) for one 3-minute clip. */
const PRICE_PER_3_MIN = { groq: "$0.0056 (+ romanizing)", sarvam: "₹1.47" };

const paths = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const clips = paths.flatMap((p) =>
  statSync(p).isDirectory() ? readdirSync(p).filter((f) => /\.(mp4|mov|webm|mkv)$/i.test(f)).map((f) => join(p, f)) : [p],
);
if (clips.length === 0) {
  console.error("Usage: npm run bakeoff -- <clip files or a folder> [--providers=groq,sarvam] [--seconds=30]");
  process.exit(2);
}
if (clips.length > 20) console.warn("Note: the server allows 20 transcriptions per hour per network; later clips will be rate limited.");
mkdirSync(OUT, { recursive: true });

const sidecar = (clip, kind) => {
  const p = clip.slice(0, -extname(clip).length) + `.${kind}.txt`;
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};

// The same speech audio the app sends (mono Opus, 48 kHz, 32 kbps), cut to SECONDS.
const audio = clips.map((clip) => {
  const ogg = join(OUT, `${basename(clip)}.ogg`);
  ff("-i", clip, "-t", String(SECONDS), "-map", "0:a:0", "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "32k", ogg);
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", ogg, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const speech = speechRegions(frameEnergiesDb(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4), 16000));
  return { clip, ogg, speech, ref: sidecar(clip, "ref"), edits: sidecar(clip, "edits") };
});

/** results[provider][clipIndex] = { words, ms } | { error } */
const results = {};
for (const provider of PROVIDERS) {
  const server = await startServer(PORT, { withKey: true, env: { TRANSCRIBE_PROVIDER: provider } });
  try {
    const config = await (await fetch(`http://localhost:${PORT}/api/transcribe`)).json();
    if (!config.provider) {
      console.error(`${provider}: not configured. Set its key in .env.local (Sarvam also needs SARVAM_TRAINING_OPT_OUT=confirmed). Skipping.`);
      continue;
    }
    results[provider] = [];
    for (const a of audio) {
      const form = new FormData();
      form.append("audio", new Blob([readFileSync(a.ogg)], { type: "audio/ogg" }), "speech.ogg");
      form.append("language", LANGUAGE);
      const started = performance.now();
      const res = await fetch(`http://localhost:${PORT}/api/transcribe`, { method: "POST", body: form });
      const ms = Math.round(performance.now() - started);
      const body = await res.json();
      const result = res.ok ? { words: body.words, warning: body.warning, ms } : { error: body.error?.code ?? `HTTP_${res.status}` };
      results[provider].push(result);
      writeFileSync(join(OUT, `${basename(a.clip)}.${provider}.json`), JSON.stringify(result, null, 1));
      console.log(`${provider}  ${basename(a.clip)}  ${result.error ?? `${result.words.length} words, ${ms} ms`}`);
    }
  } finally {
    stopServer(server);
  }
}

// ---------- Scoring ----------
const pct = (x) => (x === null || Number.isNaN(x) ? "—" : `${Math.round(x * 100)}%`);
const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);

/** Pooled scores: total edits over total reference length, so long clips weigh more. */
function score(texts) {
  let wordErr = 0, wordRef = 0, charErr = 0, charRef = 0;
  texts.forEach(({ ref, hyp }) => {
    const r = words(ref);
    wordErr += editDistance(r, words(hyp));
    wordRef += r.length;
    const rc = lenientChars(ref);
    charErr += editDistance(rc, lenientChars(hyp));
    charRef += rc.length;
  });
  return { wer: wordRef ? wordErr / wordRef : null, cer: charRef ? charErr / charRef : null, n: texts.length };
}

const rows = [];
for (const provider of Object.keys(results)) {
  const ok = results[provider].map((r, i) => ({ r, a: audio[i] })).filter(({ r }) => !r.error);
  const scored = score(ok.filter(({ a }) => a.ref).map(({ r, a }) => ({ ref: a.ref, hyp: r.words.map((w) => w.text).join(" ") })));
  const sync = summarize(ok.filter(({ a }) => a.speech.snrDb >= 20).flatMap(({ r, a }) => onsetErrors(a.speech.regions, r.words)));
  const allWords = ok.flatMap(({ r }) => r.words.map((w) => w.text));
  rows.push(
    `| ${provider} | ${ok.length}/${audio.length} | ${pct(scored.wer)} | ${pct(scored.cer)} | ${scored.n} | ${pct(devanagariShare(allWords))} | ${sync.phrases ? `${pct(sync.within)} (bias ${sync.biasMs} ms)` : "—"} | ${median(ok.map(({ r }) => r.ms)) ?? "—"} ms | ${PRICE_PER_3_MIN[provider] ?? "?"} |`,
  );
}
const withEdits = audio.filter((a) => a.ref && a.edits);
if (withEdits.length) {
  const s = score(withEdits.map((a) => ({ ref: a.ref, hyp: a.edits })));
  rows.push(`| Instagram Edits (typed) | ${withEdits.length} | ${pct(s.wer)} | ${pct(s.cer)} | ${s.n} | ${pct(devanagariShare(words(withEdits.map((a) => a.edits).join(" "))))} | n/a | n/a | free |`);
}

const perClip = audio
  .map((a, i) => {
    const lines = [`### ${basename(a.clip)} (SNR ${a.speech.snrDb.toFixed(0)} dB)`, "", `- **Reference:** ${a.ref?.trim() || "(none: add a .ref.txt)"}`];
    for (const p of Object.keys(results)) {
      const r = results[p][i];
      lines.push(`- **${p}:** ${r.error ? `error ${r.error}` : r.words.map((w) => w.text).join(" ")}${r.warning ? ` (warning: ${r.warning.message})` : ""}`);
    }
    if (a.edits) lines.push(`- **Instagram Edits:** ${a.edits.trim()}`);
    return lines.join("\n");
  })
  .join("\n\n");

const report = `# Hinglish bake-off (${new Date().toISOString().slice(0, 10)}, language: ${LANGUAGE}, first ${SECONDS} s of each clip)

WER: word error rate against your reference (lower is better). Lenient CER: character errors after
collapsing repeated letters, so spelling variants like "acha"/"accha" aren't counted as mistakes.
Scored clips: clips with a .ref.txt. Sync: phrase starts within ±150 ms (clips with SNR ≥ 20 dB). Sarvam's
word times are estimated inside each phrase. Its phrase starts are its own.

| Provider | Clips OK | WER | Lenient CER | Scored clips | Hindi-script words | Sync ±150 ms | Median time | Price / 3 min |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## Transcripts (private: don't commit or share)

${perClip}
`;
writeFileSync(join(OUT, "report.md"), report);
console.log(`\n${report.split("## Transcripts")[0]}Full report with transcripts: tests/bakeoff/.out/report.md`);
