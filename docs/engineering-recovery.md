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
| Whisper Tiny timestamped | 434.2% | 228.4% | No accepted words; 4 phrase cues | 31.8s / 57.7s | Not measured |
| Whisper Base timestamped | 89.9% | 63.8% | No accepted words; 10 phrase cues | 70.4s / 107.9s | Not measured |
| Hindi2Hinglish Swift | 43.0% | 18.9% | No usable timed cue; manual timing | 12.3s / 44.8s | Not measured |

Recognition time includes timing-fallback inference; end-to-end includes loading
and downloads. These are desktop observations, not mobile performance guarantees.
Current pinned weight inventory is about 91.4 MiB Tiny, 135.9 MiB Base and 97.7 MiB
Swift, excluding configs/runtime. No model was promoted based on these results.
Roman conversion left only Latin-script letters on this clip for all three outputs;
that does not certify other scripts/accents. No accuracy gain is claimed.

## C. Word-level timing

Chosen safe path: accept a model's own structurally valid words, otherwise use real
phrase bounds; if those are unavailable, retain text for manual timing. Swift still
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

## E. Repository hygiene and integration

Clean starting HEAD: b6d66c8562d201da4f309e849fd06f65b3b0731d on
redesign/site-and-tool-workspace. Tracked count 2,128 → 898, a reduction of 1,230;
the removed entries total 256,246,808 bytes, not 1.4 GB. Local paths remain intact;
output/recovery/output-before.zip preserves the original committed contents.
Published Git object/history size is unchanged. No commits, merges, rebases,
resets, force pushes or pruning were performed.

Recorded refs: main is 5 commits behind; matching remote topic is equal; default
origin/HEAD has 3 additional merge commits but an identical starting tree. No
network refresh is implied. Review after fetch, then make focused hygiene,
infrastructure, ASR and delivery commits only when authorized. Retained curated
design references rather than blanket deleting possible source assets elsewhere.

## F. Test results

Latest check/build: TypeScript, ESLint and **161 unit tests in 23 files passed**;
production build passed. The real three-model benchmark and scorer completed.
The current complete-chain result is pending below; prior attempts are NOT passes:

1. UI sweep stopped on 14 real checkbox-target failures; shared target fixed.
2. Media stopped on a Windows-interrupted ffprobe; independent file probe passed.
3. Passport stopped on a Windows-interrupted ffmpeg; generalized bounded handling.
4. Tiny model metadata failed with Bad Gateway; retry policy hardened.

`npm run e2e:recovery` runs a fresh build and serial owned-server suites. It stops
nonzero on any failed stage; no partial sequence is described as full success.
See [runner documentation](regression-runner.md) for prerequisites/order/logs.
Legacy opt-in release/perceptual/performance and Firefox variants are not implied
by this configured chain; physical-device and manual timing gates remain separate.

## G. Mobile and privacy evidence

Automation uses desktop Windows Chrome and mobile viewport/touch emulation, not
physical Android/iOS. Five/ten-minute real-ASR performance, background-tab behavior,
peak process/WASM memory and mobile crash rates are NOT MEASURED. The ten-minute
limit, local workers, cancellation and DSP fallback remain intact. No recordings
were uploaded to web research or inference providers; external research retrieved
public model metadata only. No new dependencies, paid APIs or mandatory accounts.

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
- **Deferred:** MP3 export, Hindi TTS, AI Reel Generator, Shorts Maker rebuild and
  SEO landing pages. No new tools or unrelated redesign were started.

## I. Important changed files

- .gitignore, package.json, scripts/regression.mjs, tests/e2e/helpers.mjs.
- Sidebar/header/scrollbar/UI/model-cache/caption suites and shared-port support.
- src/lib/subtitles/timing.ts, tools/local-ai/speech.worker.ts,
  src/lib/localtools/speechClient.ts and SubtitleStudio.tsx.
- src/lib/localtools/modelDelivery.ts, modelAssets.ts, local-model route.
- StoryMaker.tsx, command-center.css, captions.ts; removed scriptConstraint.ts.
- timing/model-delivery/probe-retry unit tests; TASKS.md and recovery documents.
