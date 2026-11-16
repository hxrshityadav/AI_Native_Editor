// Scores output/caption-bench/results.json (written by caption-bench.e2e.mjs). Run with: node tests/e2e/caption-bench-score.mjs
// English: WER/CER after lowercasing and removing punctuation. Hinglish (Roman references): Devanagari output is
// transliterated with the app's own toRoman, then compared with spelling-tolerant normalisation (aa/a, ee/i, w/v…).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
const require = createRequire(new URL("../../tools/transformers/package.json", import.meta.url));
const { buildSync } = require("esbuild");
const moduleDir = join(import.meta.dirname, "../../output/recovery/scorer");
mkdirSync(moduleDir, {recursive:true});
const compiled = join(moduleDir, "hinglish.mjs");
buildSync({entryPoints:[join(import.meta.dirname, "../../src/lib/subtitles/hinglish.ts")], outfile:compiled, bundle:true, platform:"node", format:"esm"});
const { basicNormalise, errorRates, romanNormalise, toRoman } = await import(pathToFileURL(compiled).href);

const dir = join(import.meta.dirname, "../../output/caption-bench"), runs = JSON.parse(readFileSync(join(dir, process.env.BENCH_RESULTS || "results.json"), "utf8")), clipDir = process.env.BENCH_CLIPS || "clips";
const wavSeconds = clip => { const b = readFileSync(join(dir, clipDir, `${clip}.wav`)); const rate = b.readUInt32LE(24), bytesPerSec = b.readUInt32LE(28); let o = 12; while (o < b.length - 8) { const id = b.toString("ascii", o, o + 4), size = b.readUInt32LE(o + 4); if (id === "data") return size / bytesPerSec; o += 8 + size + (size % 2); } return b.length / (rate * 2); };
if(runs.some(run=>!run.reference?.trim())) throw new Error("Every scored run needs a nonempty reference transcript.");
const rows = [], strictRows = [], rawRows = [], groups = new Map();
for (const run of runs) {
  if (!run.ok || !run.text) { rows.push(`| ${run.model} | ${run.clip} | ${run.requested} | error: ${run.error} | | | |`); continue; }
  const roman = run.kind === "hinglish", hyp = roman ? toRoman(run.text) : run.text;
  const hindiNorm = text => basicNormalise(text.replace(/[​-‍।॥]/g, " "));
  const letters = [...run.text].filter(c => /\p{L}/u.test(c)), deva = letters.length ? letters.filter(c => /\p{Script=Devanagari}/u.test(c)).length / letters.length : 0;
  const romanHindi = run.kind === "hi" && process.env.BENCH_ROMAN === "1";
  const { wer, cer } = errorRates(romanHindi ? toRoman(run.reference) : run.reference, romanHindi ? hyp.normalize("NFC") : hyp, roman || romanHindi ? romanNormalise : run.kind === "hi" ? hindiNorm : basicNormalise), audio = wavSeconds(run.clip), rtf = (run.seconds ?? 0) / audio;
  if(run.rawText){
    const rawHyp = roman ? toRoman(run.rawText) : run.rawText;
    const raw = errorRates(run.reference, rawHyp, basicNormalise);
    rawRows.push(`| ${run.model} | ${run.requested} | ${(raw.wer*100).toFixed(1)}% | ${(raw.cer*100).toFixed(1)}% |`);
  }
  const strict = errorRates(run.reference, hyp, basicNormalise);
  strictRows.push(`| ${run.model} | ${run.requested} | ${(strict.wer*100).toFixed(1)}% | ${(strict.cer*100).toFixed(1)}% |`);
  const key = `${run.model} · ${run.kind} · ${run.requested}`, g = groups.get(key) ?? { wer: [], cer: [], rtf: [], idOk: 0, idTotal: 0, words: 0, latin: 0 };
  g.wer.push(wer); g.cer.push(cer); g.rtf.push(rtf); if (run.kind === "hi" && deva < 0.5) g.latin++; g.words += run.words?.length ?? 0;
  if (run.requested === "auto") { g.idTotal++; if (run.detected?.code === (run.kind === "en" ? "en" : "hi")) g.idOk++; }
  groups.set(key, g);
  rows.push(`| ${run.model} | ${run.clip} | ${run.requested}${run.detected ? ` → ${run.detected.code} ${(run.detected.probability * 100).toFixed(0)}%` : ""} | ${(wer * 100).toFixed(0)}% | ${(cer * 100).toFixed(0)}% | ${rtf.toFixed(2)} | ${hyp.replace(/\|/g, "/").slice(0, 90)} |`);
}
const median = values => { const v = [...values].sort((a, b) => a - b), m = v.length >> 1; return v.length ? (v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) : 0; };
const mean = values => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
const summary = [...groups].map(([key, g]) => `| ${key} | ${g.wer.length} | ${(mean(g.wer) * 100).toFixed(1)}% (median ${(median(g.wer) * 100).toFixed(1)}%) | ${(mean(g.cer) * 100).toFixed(1)}% (median ${(median(g.cer) * 100).toFixed(1)}%) | ${mean(g.rtf).toFixed(2)} | ${g.idTotal ? `${g.idOk}/${g.idTotal}` : "—"} | ${g.latin} |`);
const report = `# Caption transcription benchmark (generated ${new Date().toISOString().slice(0, 10)})\n\nClips: ${new Set(runs.map(r => r.clip)).size}. ${process.env.BENCH_NOTE ?? ""}Dataset folder: ${clipDir}. Provenance/consent and manually verified references must be recorded separately; this scorer does not infer them. Synthetic clips, public FLEURS speech and the user recording are separate datasets and must not be pooled. Peak process/WASM memory and manual timing accuracy: **Not measured**. Roman spelling-tolerant WER below is a scoring convention, not an accuracy improvement.\n\n## Summary\n\n| Model · clip kind · language setting | Runs | Mean WER | Mean CER | Real-time factor | Language ID correct | Output not mostly Devanagari (Hindi clips) |\n|---|---|---|---|---|---|---|\n${summary.join("\n")}\n\nReal-time factor = recognition seconds / audio seconds (excluding model download and load), in Chrome on this Windows machine, WASM, one thread.\n\n## Raw ASR before loop cleanup\n\nStrict spelling; only script transliteration for Roman references. Historical runs lacking rawText are not listed.\n\n| Model | Requested language | WER | CER |\n|---|---|---|---|\n${rawRows.join("\n")}\n\n## Strict spelling (no tolerant substitutions)\n\nHinglish output is only transliterated to compare Roman reference scripts; no spelling-equivalence substitutions here.\n\n| Model | Requested language | WER | CER |\n|---|---|---|---|\n${strictRows.join("\n")}\n\n## Runs\n\n| Model | Clip | Language | WER | CER | RTF | Output (Hinglish shown romanised) |\n|---|---|---|---|---|---|---|\n${rows.join("\n")}\n`;
writeFileSync(join(dir, process.env.BENCH_REPORT || "report.md"), report);
console.log(`Scored ${runs.length} runs; detailed report retained locally.`);

if (!runs.length || runs.some(run => !run.ok)) process.exitCode = 1;