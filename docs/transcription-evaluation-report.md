# Transcription evaluation delivery — 17 November 2026

Status: infrastructure implemented; final full regression in progress. Natural
Hinglish accuracy and promotion remain **INSUFFICIENT DATA**. Infrastructure,
algorithm tests, actual model execution and accuracy are separate outcomes.

Architecture and exact metrics: [methodology](transcription-evaluation.md).
Import/review instructions: [annotation guide](transcription-annotation-guide.md).

The existing flat caption benchmark is preserved. New versioned schema, edit
alignment, strict/normalized scoring, reference-language metrics, overlap-safe
switch windows, entity/technical metrics, independent timing validation, sequential
worker adapters, fingerprinted caching, private report persistence and a dev-only
dashboard were added without changing production recognition/caption behavior.

## Real execution, not a quality certification

The new dashboard/CLI ran the existing local 21.7173s user clip against its existing
79-word reference. Permission is for local investigation, not distribution. The
reference is explicitly **draft**, with no reviewed language labels, word timings
or entity annotations. Speaker/condition attributes remain unknown. No annotation
or diverse corpus was fabricated. Private artifacts remain under ignored output/.

First run: `run-2026-11-17T11-01-54.056Z.json` (CLI exit 1: Tiny/Swift completed,
Base failed). Targeted Base retry: `run-2026-11-17T11-09-51.239Z.json` (exit 0).
Both are under `output/transcription-evaluation/`. Dataset and complete configuration
objects were checked identical. The table below combines clearly identified
observations from those two artifacts; it is **not** an uninterrupted successful
three-model run. The failed attempt is preserved. Its precise cause was not captured;
no network/memory diagnosis is claimed. Subsequent failures now receive sanitized
category codes and recovery actions rather than private exception strings.

| Model | Strict WER | Normalized WER / CER | S / D / I | Inference / adapter elapsed | RTF | Peak memory |
|---|---:|---:|---:|---:|---:|---|
| Tiny timestamped q4 | 434.2% | 434.2% / 228.4% | 77 / 0 / 266 | 45.93s / 67.47s | 2.11 | Not measured |
| Base timestamped q4, retry | 92.4% | 88.6% / 63.8% | 61 / 8 / 1 | 89.10s / 149.78s | 4.10 | Not measured |
| Swift q8 | 51.9% | 43.0% / 18.9% | 29 / 2 / 3 | 13.84s / 36.45s | 0.64 | Not measured |

Tiny/Base/Swift revisions respectively:
`517244293732ee2d58139af5814231b7e6830a0d`,
`608c49e61301901684bc36cac8f74b95ff6b5a8e`,
`24211661105a7bb9e96a170fb92db173667e31fd`.
Worker/runtime fingerprints and configuration are in the artifacts. These observations
used local desktop Chrome through the CLI, WASM/one thread, the existing preprocessing,
explicit Hindi transcription, 30s chunks/5s stride and native timing fallback.
Adapter elapsed includes load/decode/download; inference may include the timing retry.
RTF uses decoded audio duration. Timings are observations, not mobile guarantees.

Normalization differences are casing/token-edge punctuation effects, not a recognition
improvement. No spelling substitutions, translation or transliteration were applied.
WER above 100% is valid. One draft-reference technical clip is not a general ranking.

Hindi WER, English WER, switch-boundary WER, proper-name/technical-term accuracy and
manual timing accuracy are **unavailable** without reviewed annotations. There were
no accepted native timed words in these outputs; phrase output alone does not create
word accuracy. Gate population, held-out, timing and memory requirements are unmet.

## Implemented functionality

- Versioned manifest, local fingerprint validation, voluntary recording metadata,
  contiguous entity/term occurrences and speaker-independent train/dev/test splits.
  A deterministic test validates 101 recordings; that is not 101 natural recordings.
- Stable edit operations/positions, uncapped WER, Unicode CER, separate strict and
  normalized profiles, reference-language attribution, overlap-safe switch windows,
  entity/technical and sentence accuracy, native/supplied alignment diagnostics.
- Indexed timing errors, nonlocal overlap detection and conservative exclusion of
  repeated-word matches when counts differ and lexical ties are acoustically ambiguous.
- Existing Tiny/Base/Swift adapters, sequential disposal, failures/cancellation,
  exact cache identity, worker-backed scoring/import/save/restore, private JSON/CSV.
- Development-only dashboard: overview, metric sorting, split/noise filters,
  report-version comparison, local synchronized audio/reference inspector, error
  analysis by language/switch/condition/vocabulary/timing, configurable release gates.
- Production 404/noindex/robots/sitemap exclusion. Inputs wait for hydration before
  accepting early file selections. CLI failures ignore empty accessibility alerts,
  fail on nonempty errors and log only fixed stages/codes/completed-job counts.

## Verification ledger

TypeScript/lint and initial 223 unit tests passed before the final timing edge-case
additions. Production build passed. The final responsive dashboard workflow passed
**24/24** (controlled worker fixtures), covering real JSON/CSV downloads, exact cache
reuse, explicit private restore, audio seeking, version comparison, cancellation,
input errors, production access restriction and 1440/768/390px layouts. Screenshots
were inspected; internal gutters and folding tablet/mobile controls were corrected.
Controlled fixtures are not real ASR accuracy or performance measurements.

CLI dataset validation and two-report comparison were executed successfully. The
first real run's Base failure returned nonzero; its targeted retry returned zero.
Final uninterrupted regression results are recorded here after completion.

Early CLI attempts are not counted as model successes: one was stopped while
evaluation code was changing; later attempts exposed empty-alert and pre-hydration
file-selection races. Both were corrected before the measured artifacts above.

## Files and dependencies

Added `src/lib/transcription-evaluation/*`, the internal route and dashboard under
`src/components/transcription-evaluation/`, `scripts/transcription.mjs` plus its
TypeScript CLI, `tests/unit/transcription-evaluation.test.ts`, labelled synthetic
fixtures and `tests/e2e/transcription-benchmark.e2e.mjs`. Updated package scripts,
robots, recovery-runner coverage, TASKS/DECISIONS and transcription documentation.
Existing production worker/editor changes visible in Git predate this sprint and
were preserved. No Studio, legacy/lab or OpenReel files were introduced or edited.

No dependency or model weights were added. WhisperX/MMS feasibility review does not
constitute a browser port or a measured alignment benchmark. Peak memory, real
phones and verified diverse Hinglish accuracy remain unmeasured.

## Remaining gates and next step

The infrastructure can identify language, boundary, vocabulary and timing failures
when verified annotations exist; this corpus cannot yet demonstrate those metrics.
Collect/review the first natural speaker-independent annotation batch using the
guide, then grow toward 100+ diverse recordings. Include manually marked repeated
words, names, technical terms and switches, and independently reviewed onset/offset
times. Freeze held-out speakers before model/normalization experiments.

Still required: annotated natural accuracy/timing evaluation, reliable peak
process/WASM memory, physical low-memory Android/iOS, Firefox/Edge/Safari workflow
checks, large-corpus browser throughput and production-host asset delivery. No
forced aligner is installed or acoustically certified; Swift conversion/distribution
review remains pending. Browser model downloads can fail and require an explicit retry.
No production model is promoted by this work.
