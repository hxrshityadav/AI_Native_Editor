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
notes/PDF audio; actual model download/cache. Failure stops the chain with a nonzero exit; no suite is skipped
and counted as passing. A failed chain is incomplete even when earlier suites
passed. Fix then run the whole command again for uninterrupted certification.

Logs and a per-stage JSON ledger are in a unique timestamped folder under
ignored `output/recovery/regression/`. Captures/media use each suite's existing
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
