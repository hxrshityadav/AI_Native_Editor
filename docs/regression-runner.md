# Recovery regression command

Run `npm run e2e:recovery` from the repository root. It checks TypeScript,
ESLint and unit tests; builds exactly once; refuses an occupied port 3220;
starts its own production Next server and waits for readiness. Every suite
runs serially on that server. Suite helpers validate shared port/environment
and do not shut down the owner. The owner shuts down the server on completion
or failure. Each child has a 40-minute deadline and is terminated on timeout. Media utilities
run with hidden windows and retry an explicitly logged Windows 0xC000013A
interruption once; all format/content failures still fail immediately.

Order: actual Tiny/Base/Swift caption benchmark and scorer first, then site,
redesign, Command Center, capsule, dynamic sidebar, hover sidebar,
sidebar layout, header spacing, scrollbar, UI sweep; photo utilities/passport/
HEIC/cutout; video compressor/media/mixer/cutter/subtitle studio; local tools/
notes/PDF audio; actual model download/cache. Check/build or server-start failure stops immediately. Independent suite failures are recorded and later suites still run; the final exit remains nonzero if any stage fails. A missing fresh ASR artifact marks scoring blocked/failed instead of reusing historical output. No failure is counted as passing.

The final `transcription-benchmark` stage checks production 404/noindex exclusion,
then starts its own development server on port 3230 to test the private dashboard.
It preserves the shared production server and shuts down only its own dev process.
Its worker outputs are explicitly controlled synthetic fixtures, not recognition
accuracy results. Run `npm run asr:benchmark -- ... --consent-model-downloads` for
actual measurements through the new system. See docs/transcription-evaluation.md.

Logs and a per-stage JSON ledger are in a unique timestamped folder under
ignored `output/recovery/regression/`. Unique per-run ASR result/report names are recorded in artifacts.json. Captures/media use each suite's existing
output directory. Do not run another production build while this chain runs.
Standalone suite commands still create/clean their own production server.

Requirements: installed root and build-tool dependencies, desktop Chrome,
ffmpeg/ffprobe, writable output, network access to approved public model assets,
and a consented local benchmark WAV with matching manually reviewed TXT under
`output/caption-bench/user-hinglish/`. Public weights can exceed hundreds of MB;
running the full command is an explicit engineering model-download action.
There is no paid provider or upload. A missing clip, failed download or absent
browser is a failing prerequisite, not a skip. Raw hypotheses/references remain
in local ignored benchmark artifacts; console logs do not print transcript text.

The default model comparison runs Tiny timestamped q4, Base timestamped q4 and
Swift q8 with explicit Hindi transcription on identical user audio. This dataset
is intentionally not checked into Git. It is not a general accuracy benchmark.
See asr-evaluation-protocol.md for the dataset and manual timing release gates.

Physical mobile devices, real screen-reader speech, production hosting and
peak process/WASM memory are separate manual requirements; a Chrome viewport
matrix does not certify them. Model-size headers and byte-length checks do not
substitute for cryptographic hash verification of all downloaded weights.
