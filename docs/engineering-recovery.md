# Engineering recovery report — 16–17 November 2026

**Status: PARTIAL recovery; Hinglish and automatic word highlighting are NOT production-ready.**
The fresh comparison confirms unacceptable recognition on the available user clip.
Engineering safeguards and test infrastructure were implemented; they are not an
ASR accuracy improvement. Final uninterrupted regression status is recorded below.

## A. Issues fixed

- Removed 1,230 generated output files from the Git index and ignored /output/.
  All local files remain; an original-content ZIP and index inventory are retained.
- Reproduced stale hover failures (68/76 baseline). Corrected four sidebar suites
  to the current 56/200px capsule, 80/224px column and 144px width transfer. Preserved
  hover/exit delays, focus, touch, navigation, reduced motion and real resizing.
- Added a build-once, owned-server serial runner and integrated header, scrollbar,
  UI sweep, model/cache and real caption benchmarks. UI sweep now fails nonzero.
- Fixed the real shared narration-checkbox target defect found by the sweep on
  Text/Image to Video: clickable labels now have a 32px minimum height.
- Added bounded, logged recovery for Windows 0xC000013A media subprocess
  interruptions and hidden subprocess windows. Format errors never get retries;
  repeated interruption still fails. Both exec-style and spawn-style checks use it.
- Fixed Hindi mode accidentally selecting the hidden Roman-only Swift model.
- Removed invented word endpoints/durations. Native word timing must be finite,
  ordered, bounded and cover the returned transcript. Invalid timing retries phrase
  timing. Text with no usable timing survives for explicit manual-caption recovery.
- Retained raw ASR output separately from caption cleanup. No Swift-word/Whisper-time
  transfer, positional matching, vocabulary replacement or cloud fallback was added.
- Untimed recognition preserves existing captions and exposes the raw text on the
  Transcribe screen with an explicit manual-timing notice.
- Fixed a reproduced plain-text truncation regression: rejecting an invalid final
  timestamp retained 56 recognized characters but TXT included only 25 timed
  characters. TXT now keeps the entire recognition; incomplete SRT/VTT, segment
  translation and dubbing are blocked. Subtitle Studio and lecture notes retain
  existing edits when recognition has incomplete timing coverage.
- Patched Next.js and eslint-config-next from 16.4.3 to 16.4.6 after a verified
  Next advisory blocked the build. Root production dependency audit: zero advisories;
  seven moderate development-tool findings remain in the ESLint/minimatch chain.
- Removed unused precision/script controls, their dead scriptConstraint module,
  unused SAFE export and duplicate palette animations. Scorer uses the existing
  esbuild toolchain instead of directly importing TypeScript with a Node warning.

## B. Fresh Hinglish benchmark

Identical 21.7173-second local user recording and existing reference, explicit Hindi
transcription, WASM/one thread, 30s chunks and 5s stride. Tiny/Base use q4; Swift q8.
One clip is not a general model ranking; independent reference review and diverse
code-switching coverage remain incomplete. No new corpus or speaker claims are made.

Strict spelling WER/CER below uses only script conversion for the Roman reference,
not the tolerant spelling substitutions or loop cleanup. WER above 100% is valid
when insertions are numerous. Raw results remain local under ignored output/.

| Model | WER | CER | Timing result (acoustic accuracy unmeasured) | Recognition / end-to-end | Peak memory |
|---|---:|---:|---|---:|---|
| Whisper Tiny timestamped | 434.2% | 228.4% | No accepted words; 4 partial cues, manual recovery | 45.0s / 83.9s | Not measured |
| Whisper Base timestamped | 89.9% | 63.8% | No accepted words; 10 partial cues, manual recovery | 70.5s / 126.2s | Not measured |
| Hindi2Hinglish Swift | 43.0% | 18.9% | No usable timed cue; manual recovery | 12.2s / 41.3s | Not measured |

These measurements come from the fresh 17 November run, not historical artifacts:
`output/caption-bench/recovery-2026-11-17T05-39-05.827Z.json`.
Its matching Markdown report contains separate raw, product and tolerant scores.

Recognition time includes timing-fallback inference; end-to-end includes loading
and downloads. These are desktop observations, not mobile performance guarantees.
Current pinned weight inventory is about 91.4 MiB Tiny, 135.9 MiB Base and 97.7 MiB
Swift, excluding configs/runtime. No model was promoted based on these results.
Roman conversion left only Latin-script letters on this clip for all three outputs;
that does not certify other scripts/accents. No accuracy gain is claimed.
Separate Hindi/English span accuracy, proper-name/technical-term rates and
speaker/noise subgroup metrics are not measured; the reference lacks those
annotations. Timing validators fix data correctness, not recognition errors.

One minimum-edit alignment against the 79-word strict Roman reference gives:
Tiny 77 substitutions / 0 deletions / 266 insertions (345 output words); Base
61 / 8 / 2 (73 output words); Swift 29 / 2 / 3 (80 output words). Ties can change
the operation breakdown; totals were checked against the scorer's edit distance.
These are text-edit counts, not independent acoustic hallucination annotations.
All three report incomplete timing coverage; partial cues do not replace existing
creator captions or masquerade as a complete timed transcript.

## C. Word-level timing

Chosen safe path: accept a model's own structurally valid words, otherwise use real
phrase bounds only when they cover the transcript; if timing is missing or partial,
retain text for manual timing and preserve existing creator edits. Swift still
has no creator-quality word alignment. Repeated words, pauses, punctuation, invalid
bounds and missing transcript coverage have unit coverage. These are structural
checks, not manually annotated onset/offset measurements. Forced alignment,
manual timing error/coverage, and automatic karaoke certification remain NOT FIXED.
See [evaluation gate](asr-evaluation-protocol.md).

## D. Model delivery and source trust

A real upstream 1KiB Range request returned HTTP 206 with the correct Content-Range.
The local route now forwards single Range/If-Range, retains status/range headers,
rejects malformed or multi-range input and validates streamed byte lengths.
A reproduced Tiny metadata Bad Gateway led to five-attempt, cancellation-aware
exponential backoff with jitter. Full Swift HTTP 200 downloads are checked with
streaming SHA-256 against authoritative LFS hashes without whole-model buffering.

These guards do NOT implement persistent partial storage/resume, hash every model,
or rehash existing browser-cache bytes. Partial responses are not full-model hash
verification. Production hosting/CDN response limits and resume behavior remain
unverified. No cache-wide/database deletion was introduced.

The pinned [Swift card](https://huggingface.co/Hirecentive-D3l/Whisper-Hindi2Hinglish-Swift-ONNX/blob/24211661105a7bb9e96a170fb92db173667e31fd/README.md)
declares Apache-2.0, Oriserve ancestry and an optimum/QUInt8 conversion. Config and
tokenizer families match Whisper Base. Public metadata supplies sizes/hashes.
The card's example repository name differs from the actual owner, and full
conversion equivalence is not independently reproduced. Source trust/licensing
review remains a release gate. Pins and model allowlists were not loosened.
Full source/hash evidence is in [audit ledger](engineering-recovery-audit.md).

Final localhost model/cache suite: **17/17 passed**. The actual SpeechT5 decoder
was 244,486,683 bytes and matched the reviewed SHA-256. Cold generation, concurrent
interruption, targeted repair of a truncated decoder, verified Whisper bytes,
reload and fresh-worker ASR/TTS with model requests blocked all passed. No warm
model redownload was attempted. Old model caches, a Studio cache sentinel and an
IndexedDB project sentinel survived. These are localhost observations, not a
production-host or complete runtime-integrity certification.

## E. Repository hygiene and integration

Clean starting HEAD: b6d66c8562d201da4f309e849fd06f65b3b0731d on
redesign/site-and-tool-workspace. Tracked count 2,128 → 898, a reduction of 1,230;
the removed entries total 256,246,808 bytes, not 1.4 GB. Local paths remain intact;
output/recovery/output-before.zip preserves the original committed contents.
Published Git object/history size is unchanged. The agent created no commits,
merges, rebases, resets, force pushes or pruning operations.

Initial recorded refs: main was 5 commits behind; matching remote topic was equal;
default origin/HEAD had 3 additional merge commits with an identical starting tree.
During the pause the user committed the prior recovery work as `c9269da`.
That commit has 905 tracked files and zero tracked output entries. The recorded
topic remote matches it; main is now 6 commits behind and origin/HEAD has four
additional merge commits with an identical tree. No network refresh is implied.
Review after fetch, then make focused hygiene,
infrastructure, ASR and delivery commits only when authorized. Retained curated
design references rather than blanket deleting possible source assets elsewhere.

## F. Test results

Latest check/build: TypeScript, ESLint and **162 unit tests in 23 files passed**;
production build passed. The real three-model benchmark and scorer completed.
**The final uninterrupted `npm run e2e:recovery` run passed with exit 0: all 27
stages, 2,004 browser assertions, 245 route×width UI checks and three real ASR
runs.** These counts all belong to one fresh build/owned server, not pooled runs.

Evidence: `output/recovery/regression/2026-11-17T05-39-05.827Z/results.json`,
its individual suite logs and `artifacts.json`. Total recorded stage time was
1,529.2 seconds; this is test duration, not a product throughput benchmark.
The owned port 3220 was released on completion. Final `git diff --check` passed.

| Final suite group | Actual result |
|---|---:|
| Site / redesign / Command Center | 160/160 · 93/93 · 15/15 |
| Capsule / dynamic / hover / sidebar layout | 86/86 · 124/124 · 76/76 · 61/61 |
| Header spacing / scrollbar | 872/872 · 178/178 |
| UI sweep | 245 combinations; zero findings |
| Photos / passport / HEIC / background | 44/44 · 13/13 · 11/11 · 13/13 |
| Video compressor / media / mixer / cutter zoom | 37/37 · 45/45 · 15/15 · 21/21 |
| Subtitle Studio | 41/41 |
| Local tools / notes / PDF audio | 46/46 · 16/16 · 20/20 |
| Model delivery/cache | 17/17 |
| Real caption benchmark / scorer | Three models completed; scores remain unacceptable |

Earlier failed or interrupted attempts remain part of the record, not passes:

1. UI sweep stopped on 14 real checkbox-target failures; shared target fixed.
2. Media stopped on a Windows-interrupted ffprobe; independent file probe passed.
3. Passport stopped on a Windows-interrupted ffmpeg; generalized bounded handling.
4. Tiny model metadata failed with Bad Gateway; retry policy hardened.
5. The first uninterrupted patched run completed with model/cache 15/17: cold and
   warm TXT lost an untimed final phrase. Byte/hash/cache/storage checks passed.
   A real-worker diagnostic established the caller truncation above. After the
   fix, focused local tools 46/46, notes 16/16 and subtitle recovery 5/5 passed.
6. An intervening run was intentionally stopped for a callback wiring correction;
   it is not counted as passing. The new complete run starts from a fresh build.

`npm run e2e:recovery` runs a fresh build and serial owned-server suites. Check,
build and server-start failures stop immediately. Independent suite failures are
collected while later suites run; the final exit is nonzero if any stage failed.
Unique per-run ASR artifacts prevent scoring stale output after a failed benchmark.
No partial sequence is described as full success.
See [runner documentation](regression-runner.md) for prerequisites/order/logs.
Legacy opt-in release/perceptual/performance and Firefox variants are not implied
by this configured chain; physical-device and manual timing gates remain separate.

## G. Mobile and privacy evidence

Automation uses desktop Windows Chrome **157.0.8103.51** and mobile viewport/touch emulation, not
physical Android/iOS. Five/ten-minute real-ASR performance, background-tab behavior,
peak process/WASM memory and mobile crash rates are NOT MEASURED. The ten-minute
limit, local workers, cancellation and DSP fallback remain intact. No recordings
were uploaded to web research or inference providers; external research retrieved
public model metadata only. No new dependency families, paid APIs or mandatory
accounts; existing Next.js dependencies received the security patch above.
The final cold short-English SpeechT5 workflow took 106.49 seconds, including
downloads, model initialization and generation. It is one desktop observation,
not an inference-only speed, pronunciation evaluation or mobile performance claim.
WebAssembly inference succeeded without cross-origin isolation. WebGPU was
available but GPU inference was not exercised by these WASM jobs.

## H. Remaining blockers

- **Not fixed:** production-quality Hinglish recognition, dependable Hindi script,
  Swift word alignment and manually measured acoustic timing. A broader consented,
  manually referenced corpus and word annotations are required; synthetic speech
  and one technical clip cannot replace them.
- **Partially fixed:** model delivery. Persistent resume, complete cache/weight
  integrity coverage and production-host delivery validation remain.
- **Needs source/product decision:** independently reproduce/verify the third-party
  Swift conversion or choose a trustworthy replacement after broad evaluation.
- **Requires physical testing:** low-memory Android/iOS, five/ten-minute jobs,
  cancellation/background recovery and real memory measurements.
- **Development dependency audit:** seven moderate ESLint/minimatch-chain findings
  remain. Production-only audit is clean; this does not certify application security.
- **Deferred:** MP3 export, Hindi TTS, AI Reel Generator, Shorts Maker rebuild and
  SEO landing pages. No new tools or unrelated redesign were started.

Required manual verification before certifying ASR or mobile delivery:

1. Record consent/provenance for varied real Hinglish speakers and manually review
   each reference. Run the same audio/settings through all candidates; separately
   annotate Hindi/English spans, names, technical terms and hallucinations.
2. Annotate word onsets/offsets in recordings with pauses, repeated words and fast
   code switching. Compare accepted native words against those annotations; record
   timing error and coverage before enabling a production-quality karaoke claim.
3. On physical low-memory Android Chrome and iOS Safari, process short, five-minute
   and ten-minute inputs. Measure peak memory and inference time; cancel during
   loading/inference, background the tab, reload, and check project recovery.
4. On the intended deployed host, download the full 244,486,683-byte SpeechT5
   decoder and Swift weights cold, interrupt mid-stream, retry, issue concurrent
   requests and verify hashes. Check CDN timeouts/response limits and warm reload
   with model network blocked. Localhost results do not certify that host.
5. Independently verify/reproduce the Swift conversion, ownership and applicable
   license chain. Validate all cached weight bytes, including same-length corrupt
   entries; confirm repair touches only the affected model cache entry and keeps
   Studio projects and unrelated stores intact.

## I. Important changed files

- .gitignore, package.json, scripts/regression.mjs, tests/e2e/helpers.mjs.
- Sidebar/header/scrollbar/UI/model-cache/caption suites and shared-port support.
- src/lib/subtitles/timing.ts, tools/local-ai/speech.worker.ts,
  src/lib/localtools/speechClient.ts and SubtitleStudio.tsx.
- SpeechTool.tsx, useTranscriptSession.ts, TranscriptControls.tsx and
  LectureNotes.tsx; shared timing-coverage helper in src/lib/localtools/text.ts.
- src/lib/localtools/modelDelivery.ts, modelAssets.ts, local-model route.
- StoryMaker.tsx, command-center.css, captions.ts; removed scriptConstraint.ts.
- timing/model-delivery/probe-retry unit tests; TASKS.md and recovery documents.
