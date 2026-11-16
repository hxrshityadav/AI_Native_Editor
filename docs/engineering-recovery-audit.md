# Engineering recovery — 16 November 2026

## Starting checkpoint

Working tree clean at b6d66c8562d201da4f309e849fd06f65b3b0731d.
No reset, merge, rebase, commit or remote write is authorized by this work.
Current branch: redesign/site-and-tool-workspace. Recorded refs (not a network
refresh): main is its ancestor, 0/5 behind/ahead. Matching remote topic branch
is 0/0. origin/HEAD points to claude/zealous-heisenberg-vvgt3o and is 3 commits
ahead of this branch. HEAD itself changed 10,230 files. Do not rewrite it.

Recovery point is the clean committed HEAD. Index inventory and baseline status
are preserved locally in output/recovery/ before untracking generated files.
Untracking output changes the index only; its local contents must remain intact.

## Checklist

- [x] Untrack generated output, retain local files and document measurements.
- [x] Reproduce stale sidebar checks against current intended geometry.
- [x] Add deterministic build-once, shared-server serial regression runner.
- [x] Integrate header, scrollbar, UI and caption suites without silent skips.
- [x] Audit ASR audio, decoding, script conversion and timing data flow.
- [x] Remove unused benchmark controls and misleading scoring provenance.
- [ ] Verify available recordings, consent and manual references before quality claims.
- [x] Audit download allowlists, pinning, integrity and interrupted recovery.
- [ ] Run available regressions and document genuine blockers.

Future integration: separate generated-index cleanup, test infrastructure,
ASR/timing fixes and delivery changes into reviewable commits when authorized.
Fetch and review the three default-branch commits before choosing a merge;
do not automatically merge or rewrite published branch history.

## Measurements and verified findings

- 1,230 generated output entries removed from index; tracked count 2,128 → 898.
  Those local files total 256,246,808 bytes (about 244.4 MiB), not the claimed
  1.4 GB of tracked content. /output/ ignored; files still on disk. Git object
  storage is unchanged; published history still contains old outputs.
- Baseline hover suite: 68/76. Eight failures were the old 208px capsule and
  152px delta expectations; current intended geometry is 200px/56px, 224px/80px
  allocation and 144px width transfer. Assertions remain numerical and check
  timing, focus, pointer exit, mobile, geometry and actual interpolating frames.
- Repository has 30 current tool directories, including newer mixer/subtitle
  work. Removed editor routes stay removed; no editor engine was reintroduced.
- UI sweep previously returned success even with defects. It now fails nonzero.
  Its old report had 217 flagged route-widths largely caused by counting
  deliberately screen-reader-only labels as clipped and inline prose links as
  standalone targets. The detector now respects those semantics and measures
  associated checkbox labels as the clickable target; actual standalone controls
  and rendered clipping still fail.
- Worker synthesized missing word start/end values and a minimum 20ms duration.
  Those invented boundaries are removed. Invalid word timing retries phrase
  timing explicitly; phrase chunks also require finite real bounds. No alignment
  accuracy claim follows from these structural guards.
- Experimental output-script bans and precision override removed from worker,
  request type and benchmark. No UI caller used them. Unused scriptConstraint
  module and SAFE export removed. Duplicate palette animations consolidated on
  the existing public motion rule. Scorer bundles the shared TS utility through
  the existing esbuild install; baseline scoring ran without the Node TS warning.
- The Hindi mode selector accidentally chose the Roman-only Swift model while
  hiding it from the Hindi choices. It now chooses Tiny/Base for Hindi, retaining
  Swift only for Roman Hinglish. Generic Hindi accuracy/script limitations remain.

## Model source and delivery audit

Pinned Swift card inspected on 16 November 2026:
https://huggingface.co/Hirecentive-D3l/Whisper-Hindi2Hinglish-Swift-ONNX/blob/24211661105a7bb9e96a170fb92db173667e31fd/README.md
It declares Apache-2.0, names Oriserve/Whisper-Hindi2Hinglish-Swift as base,
Whisper Base architecture, optimum export with past and dynamic QUInt8 ONNX
quantization. Its usage sample names TechHirecentive rather than the actual
Hirecentive-D3l repository. This mismatch and the absence of a fully reproducible
conversion recipe/checkpoint equivalence keep conversion provenance partially
verified, not fully trusted. Ownership is the public repository author field,
not an independently authenticated relationship to Oriserve.

Pinned HF metadata API returned revision 24211661105a7bb9e96a170fb92db173667e31fd:
- encoder_model_quantized.onnx: 23,145,769 bytes, SHA256
  0cd4fb050fa9138a075571d9bc0228e2a06ae58951cd4210d3d78bfdf1fd5b9f.
- decoder_model_merged_quantized.onnx: 79,336,412 bytes, SHA256
  ffab3719c07a7055cd818d194e166c8ed6b214e3e80f6c4ea04b201a4cf12cbe.
These are authoritative repository LFS declarations, not a newly computed hash
of the full local weights. The new worker does not claim to verify those hashes.
Speaker-vector SHA256 validation already exists; model byte-length checks are
not cryptographic integrity checks.

Actual upstream range probe: GET bytes=0-1023 returned HTTP 206, Content-Length
1024, Content-Range bytes 0-1023/23145769 and Accept-Ranges bytes. Headers/bytes
are in output/recovery/swift-range-headers.txt and swift-range.bin. Local route
now forwards a single Range/If-Range, retains 206 and range response headers,
rejects malformed/multi-range inputs, and detects truncated/oversize bodies.
A server that ignores Range returns its full 200 body; no client concatenation
or partial-cache promotion occurs. Existing cache API will not store 206 as a
complete response. There is still no persistent partial-download store/resume
controller, streaming SHA verification for every weight, or new exponential
backoff/jitter implementation. These requirements remain partially fixed.
No allowlist was loosened and main URL aliases still resolve to fixed commits.

## Scope control and unverified work

Current automated checks are Chrome on this Windows host, including viewport
emulation; no physical Android/iPhone, Firefox or Edge recovery run is claimed.
No reliable new WER/CER or acoustic timing improvement is claimed before the
fresh benchmark. The corpus cannot be expanded with invented people, private
uploads or synthetic examples labelled as real conversation. More consented
recordings and manually annotated boundaries are an external release gate.

Other generated runtime directories (public/local-ai, public/ort, public/pdfjs,
node_modules, .next) are already ignored. Tracked .impeccable/.taste-skill items
mix approved concept/reference artifacts and design metadata; retained rather
than blanket deleting or ignoring possible source references. Historical Git
objects, including eight pre-existing temporary-object warnings, were not pruned.

MP3 export, Hindi speech synthesis, AI Reel Generator, Shorts Maker and SEO
landing pages remain explicitly deferred; no cloud provider, payment feature,
model promotion or unrelated redesign was added.

First uninterrupted attempt stopped correctly at the UI sweep: 245 route-width
checks, 14 failures, all from the shared StoryMaker narration checkbox target
on Text/Image to Video at seven widths. The associated label was shorter than
24px. Both narration/consent labels now have a 32px minimum clickable height;
the checkbox remains the established 18px visual. This is an actual target fix,
not a lower detector threshold. A complete restart is required after this fix.
A local output-before.zip archive from the clean starting HEAD preserves the original tracked output contents, independently of later test screenshots written to their usual paths.

Second attempt passed the UI sweep (245/245) and video compressor (37/37),
then stopped in media because ffprobe exited 0xC000013A with no diagnostic.
An independent ffprobe of the same M4A succeeded (6.016s, 122,255 bytes).
The helper now retries that exact Windows OS-interruption status once, with
an explicit warning; format errors and a repeated interruption still fail.
Two unit tests cover success after interruption, immediate format failure and
repeated interruption. The original failed chain remains recorded; a complete
third run is required, not a claim that the failed run passed.

Pinned Swift config/tokenizer JSON were also retrieved (one fetch failed, retry
succeeded): model_type whisper, WhisperForConditionalGeneration, d_model 512,
6 encoder/6 decoder layers, vocab_size 51865, WhisperTokenizer. This supports
configuration-family compatibility with the claimed Whisper Base architecture;
it does not establish weight equivalence to the claimed fine-tune. Saved JSON
is local under output/recovery/, not a runtime change.

Recorded default-branch commits ahead of HEAD are three merge commits
(31741d9, c58526f, f3aff05); git diff HEAD origin/HEAD is empty. Thus the
recorded branch difference is history-only at the starting checkpoint, not a
source-tree difference. Re-check after a future fetch before integration.

Third attempt stopped on the same OS interruption status in a direct ffmpeg
passport pixel-read subprocess. The same bounded wrapper now covers synchronous
ffmpeg/ffprobe operations (including spawn-style decode checks), with hidden
windows; content/format failures still fail immediately. The fourth/finalized
runner orders the real-ASR comparison immediately after its build, ahead of UI
regressions, so a later unrelated infrastructure failure cannot hide ASR evidence.

Timestamp acceptance also checks full transcript coverage, not just numeric
bounds. When raw text exists but no reliable timed chunks exist, it is retained
for manual captioning instead of being lost or stretched over the recording.
The UI explicitly explains the missing timing and stays on transcription review.
This remains a fallback, not forced alignment or measured acoustic accuracy.

Update after the metadata-download failure: the current route retries transient
failures up to five attempts using cancel-aware exponential backoff plus jitter.
Fresh full Swift weight responses are checked incrementally against the pinned
LFS byte counts and SHA256 values in Node, without buffering entire models.
Existing browser-cache bytes and partial responses are not thereby fully hashed;
persistent resume and comprehensive cache integrity remain unresolved.

Fresh identical-audio comparison completed for all three models on the existing
21.7173125s user recording. Strict spelling WER/CER after only script conversion:
Tiny 434.2%/228.4%, Base 89.9%/63.8%, Swift 43.0%/18.9%. Recognition pipeline times
31.8s, 70.4s, 12.3s; end-to-end 57.7s, 107.9s, 44.8s. No accepted word timing.
Swift has no usable phrase cue and retains its raw text for manual timing.
Peak process/WASM memory and manually annotated acoustic timing: Not measured.
This is one clip against its existing reference, not a general model ranking.
