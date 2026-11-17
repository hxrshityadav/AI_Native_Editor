# Local transcription evaluation

This system measures recognition and timing independently. It does not change the
production speech worker, model selection, captions, Studio or exports. Quality
gates never promote a model. An imported report is evidence supplied by its author,
not a cryptographic attestation that a model ran.

## Architecture

Version-1 dataset + local audio → SHA-256 validation → sequential adapters around
the existing `runSpeech` worker → raw transcript → deterministic text alignment →
strict and normalized scores → JSON/CSV report → internal recording inspector.

Core modules live in `src/lib/transcription-evaluation/`. The dashboard is
`/dev/transcription-benchmark`, served **only by `next dev`**. Production returns
404 regardless of environment flags. It is absent from the sitemap, disallowed in
robots and noindex. No server endpoint reads datasets, audio, transcripts or reports.
Public tool navigation and pages do not import the dashboard.

The dashboard keeps files in tab memory. Playback and inference require the
manifest's SHA-256 to match. Selecting a file is not an upload. Optional downloads
require consent; requests retrieve only the existing allowlisted public assets.
ASR runs in the existing worker, one model at a time, using the existing mono 16kHz
continuous resampler, language option, 30s chunks/5s stride and phrase fallback.
The adapter's `load` prepares capabilities/consent; actual model loading happens
inside the existing transcription request, not a second engine.

Scoring and report-import rescoring run in a separate cancellable worker. Text
alignment is bounded to 16 million cells and CER to 50 million character-cell
operations. Split longer recordings if these limits are exceeded. Existing speech
processing still refuses inputs above ten minutes; evaluation fingerprinting is
limited to 128 MiB per file. JSON imports are limited to 25 MiB. The dataset schema
supports 1–1,000 recordings; large corpora can be split into speaker-independent
versioned batches. This does not establish device memory support.

## Run and reproduce

1. Create a dataset JSON using [the annotation guide](transcription-annotation-guide.md).
   Keep private datasets and outputs under ignored `output/`, never `public/`.
2. `npm run asr:validate -- path/to/dataset.json` validates schema, referenced local
   files and fingerprints. It does not certify human annotation quality.
3. Start `npm run dev`; open `/dev/transcription-benchmark`. Import the manifest and
   matching local files or its dedicated folder. Select models/options and consent,
   then run the selected recording or all filtered recordings. Cancellation stops
   the active worker/scorer; completed results remain, and unattempted jobs do not
   receive invented measurements.
4. Or drive that same dashboard with:

   ```text
   npm run asr:benchmark -- path/to/dataset.json --url http://localhost:3000 --models tiny,base,hinglish-swift --consent-model-downloads
   ```

   The CLI permits loopback URLs only, requires explicit download consent, checks
   local paths against the manifest directory (including real symlink targets),
   and saves private JSON/CSV under `output/transcription-evaluation/`. It reports
   counts, not speech contents or original filenames. Failed model jobs exit nonzero.
5. `npm run asr:compare -- report-one.json report-two.json` recomputes scores and
   writes comparison JSON/CSV under that same ignored output directory. Different
   datasets/configurations are descriptive comparisons, not controlled accuracy gains.

The committed `tests/fixtures/transcription/dataset.json` and tone WAV are synthetic
algorithm fixtures. The tone does **not** speak the constructed reference words.
They test validation, deterministic scoring and UI behavior, never natural ASR quality.

## Text and denominators

All profiles apply NFC and collapse whitespace. `strict` keeps case and punctuation.
`roman-hinglish`, `english`, `hindi-roman` and `punctuation-insensitive` additionally
lowercase and remove punctuation at token edges. They intentionally share the same
lexical policy; the name never selects a translator or phonetic spelling dictionary.
Internal punctuation and symbols stay: `Spring-Boot`, `don't` and `C++` remain
distinct terms. CER removes whitespace after the declared profile and counts Unicode
code points. Unknown words, diacritics and non-Roman model output are retained and
can score as errors. References must be Roman. No script conversion is performed.

This differs from historical caption benchmark reports that transliterated model
output and sometimes used spelling-tolerant substitutions. Do not compare those
numbers as if they used this scorer's normalization. Raw output and production
cleanup output are both retained; this scorer uses raw output.

WER = (S + D + I) / reference words. It is uncapped and unavailable with an empty
reference, even when insertions exist. Alignment returns operation, reference and
hypothesis indices, words and insertion anchor. Ties resolve diagonal → deletion
→ insertion. This is deterministic, not a unique acoustic explanation of errors.
CER uses character edit distance / reference non-whitespace code points, with a
null rate for an empty denominator. Normalized and strict scores are separate.

Hindi/English/other WER uses manually supplied **reference** word languages. A
substitution/deletion belongs to its reference word; an insertion belongs to the
following reference word, or the final reference word at EOF. Language counts sum
to overall counts when all reference words are labelled. No annotations means
language metrics are unavailable, not inferred from predicted spelling.

Switches come only from reference language transitions. The default window includes
two reference words on each side, including adjacent words. We align the complete
transcript once and count its anchored edits inside the **union** of context windows.
This prevents local re-alignment from changing error attribution or overlapping
windows counting an edit twice. All-transition and hi→en/en→hi results are returned.
Direction-specific windows can overlap each other; their rates are independent and
must not be added. A window with no reference transition has an unavailable rate.

Proper-noun and technical-term accuracy = exact contiguous mentions recognized /
annotated mentions evaluated. Occurrence IDs group multiword mentions; each repeated
mention gets a new ID. A substitution/deletion or insertion inside a mention makes
it incorrect. An unrelated insertion after a mention does not. Additional technical
phrases can be configured per benchmark; they match the reference, never rewrite
predictions or infer a language. Sentence accuracy = error-free reference sentences /
sentences evaluated, using `.?!` reference endings and a trailing fragment. Insertions
are assigned by the same reference anchors.

Comparison tables use micro-averages: sum errors / sum denominators, not the mean
of clip percentages. Failed/cancelled jobs are counted visibly and excluded from
numeric averages. Different completed populations are not ranked. Cached results
retain original performance measurements, not a newly measured speed.

## Timing and independent alignment

Reference times must be explicitly marked manually reviewed before any timing
accuracy is reported. Recognition and timing are separate. Native word, native
phrase and independently supplied forced-alignment outputs share an interface.
An external alignment must name its method/provenance and exactly match this
model's raw transcript. It is not assigned to another model by word position.

Predicted word text must cover the same model's transcript. Only text-correct
aligned words with finite, positive, bounded, monotonically nonoverlapping native
times contribute timing errors. Overlapping neighbors are both invalidated.
Pauses are counted as gaps, not labelled errors or filled with invented times.
Nested/nonlocal overlaps are detected too. If repeated-word counts differ between
reference and hypothesis, ambiguous occurrences are excluded from timing accuracy;
the deterministic WER tie is not treated as proof of the acoustic word occurrence.

- Word timing coverage = valid text-correct aligned timed reference words / all
  manually timed reference words. Missing/invalid/unmatched proportion = 1−coverage.
- Start and end errors are absolute differences in seconds against manual bounds.
  MAE averages all valid start/end errors equally. Median and P90 use linearly
  interpolated quantiles of those boundary errors. No valid pairs means no MAE.
- Phrase coverage = manually timed reference-word duration intersecting valid native
  phrase intervals / total manually timed reference-word duration. It does not
  generate word times and does not establish accurate phrase boundaries.
- With no word timestamps, coverage is zero if manual ground truth exists and MAE
  is unavailable; with no reviewed reference timing, all timing accuracy is unavailable.

Forced aligners are not installed. See the primary-source review below and the
external `AlignmentOutput` import contract. The first release evaluates available
native timing and supplied alignments; it does not implement new forced inference.

## Models, timing and reproducibility

The adapter inventory imports current revision pins from `modelAssets.ts`: Tiny
timestamped q4, Base timestamped q4 and Swift q8. Approximate Tiny/Base sizes are
labelled approximate; Swift's known encoder+decoder weight sum is 102,482,181 bytes,
excluding configs/runtime. The model card's declared license is not sufficient to
certify a converted checkpoint; Swift distribution review remains pending.

JSON records schema/scorer versions, model repository/revision/precision, dataset
and annotations, configuration, worker/runtime JS fingerprint, raw/cleaned outputs,
failures/cancellation and timings. Cache keys include the complete canonical dataset,
recording ID, audio SHA-256, model metadata, configuration and scorer version. Changing
annotation, vocabulary, revision, precision, input, language, worker/runtime or profile
invalidates a prior key. Successful results alone are reusable. Reports from a
different scorer version need an explicit migration rather than silently trusted scores.

RTF = worker inference seconds / audio duration. Inference seconds follow the existing
worker and can include a timing-fallback inference; end-to-end elapsed includes load,
decode and download. Peak memory is **not measured**: JS heap is not peak WASM/process
memory. Gates cannot pass missing performance evidence. Browser/model initialization
can fail; all adapters dispose before proceeding to the next model. CLI and dashboard
use the same audio files/preprocessing and do not run large models concurrently.

Save is explicit. The isolated `reel-finisher-asr-evaluation-v1` IndexedDB stores
reports/references only, never media. Reload does not restore private text implicitly;
choose Load saved reports. Matching audio must be reselected. Quota/corrupt-storage
errors offer JSON export and never clear Studio databases or unrelated caches.

## Release gates

Targets are configurable and do not claim current performance: overall/Hindi WER
<15%, English WER <10%, switch WER <20%, word coverage >95%, timing MAE <100ms.
Additional initial engineering defaults are at least 30 reviewed natural held-out
clips from 10 speakers, RTF ≤2 and peak memory ≤1 GiB. These are configurable starting
constraints, not a statistical power analysis or a validated device budget.

PASS/FAIL requires sufficient reviewed **natural** held-out data, all held-out records
evaluated, every job successful, a denominator for that metric, and measured values.
Otherwise show INSUFFICIENT DATA. Train/development clips and synthetic fixtures do
not meet the promotion population. Licensing is a separate gate. Nothing automatically
changes a production model, even if one has the lowest observed error rate.

## Forced-alignment options reviewed (17 November 2026)

| Option | Primary-source finding | Browser decision |
|---|---|---|
| Existing Whisper native timing | Current pinned timestamped exports already run in the local worker; text/structural validation is implemented | Evaluate native output; acoustic accuracy remains unverified |
| [WhisperX](https://github.com/m-bain/whisperX) | Wav2vec2 alignment in a Python/PyTorch pipeline; CPU and CUDA paths documented. [Code license](https://github.com/m-bain/whisperX/blob/main/LICENSE) is BSD-2-Clause; each selected weight needs separate review | No browser/WebGPU/worker/cancellation equivalence demonstrated. Size/memory depend on alignment model. No install or weights added |
| [Meta MMS-1b-all](https://huggingface.co/facebook/mms-1b-all) CTC family | Primary card specifies one billion parameters and CC-BY-NC-4.0. At 32-bit precision that implies roughly 4GB parameter storage alone, not measured working RAM | Noncommercial restriction and large footprint block adoption here. No verified browser ONNX, CPU/WebGPU, cancellation or worker performance. No weights added |

These are feasibility observations, not benchmarked aligner recommendations. Any
future candidate needs exact model/revision/license, measured converted size and
memory, script/token compatibility with Roman Hinglish, worker cancellation and
held-out manual timing evaluation before integration. Public research retrieved only
primary documentation; no speech, references or hypotheses were sent externally.

## Verification commands

`npm run check`, `npm run build`, `npm run e2e:transcription`, `npm run e2e` and
`npm run e2e:recovery`. The recovery runner includes the internal workflow as a
separate final stage with its own development server while preserving the owned
production server. Controlled worker fixtures test algorithms/control flow; actual
model measurements are reported separately in [the delivery report](transcription-evaluation-report.md).
