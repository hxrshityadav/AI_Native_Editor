# Local ASR evaluation gate

The independent evaluation system is now documented in
[transcription-evaluation.md](transcription-evaluation.md), with the versioned
[annotation guide](transcription-annotation-guide.md). Use `asr:validate`,
`asr:benchmark`, `asr:compare` and the development-only
`/dev/transcription-benchmark` dashboard. Historical scores below used different
transliteration/tolerant conventions; new strict/normalized raw scores do not
silently transliterate or fix spellings. Compare only declared matching profiles.

Do not promote a model based on one recording or on spelling substitutions.

Available local data (16 November 2026):

| Dataset | Provenance/permission | Reference status | Limits |
|---|---|---|---|
| output/caption-bench/user-hinglish | Existing user-supplied recording; used only locally for this requested investigation | Existing TXT; user confirms output is incorrect; independent reference review not established | One technical creator clip, no diversity evidence |
| output/caption-bench/fleurs-hi | google/fleurs hi_in validation; CC BY 4.0, owner download approval documented in docs/research/README.md and local SOURCE.json | Dataset raw_transcription; not newly manually verified here | 20 short clips, all labelled female; Hindi, not natural Hinglish conversations |
| output/caption-bench/clips | Locally generated Windows speech, previous benchmark | Scripted synthetic references | Smoke tests only; not real accents/code switching |

No new real recordings or speaker demographics are fabricated. Local private
audio, references, raw hypotheses and all benchmark outputs stay under ignored
output/. They must never be sent to Jina, a search engine or an inference API.

Required next corpus additions: consented male/female and varied-accent natural
conversations, creator monologues and technical explanations; Hindi-heavy and
English-heavy code switching; clean/noisy, slow/fast, near/far microphone;
short clips and five/ten-minute recordings. Each entry needs an opaque ID,
source/permission, duration, speaker/recording attributes voluntarily supplied,
and a manually checked verbatim reference. Unknown fields stay unknown.

For timing, separately annotate word start/end on the original audio, including
short/long pauses, repeated words and code-switch boundaries. Record annotator,
tool/version, disagreement and adjudication. Report median/P95 absolute onset
and offset errors, coverage, deletions and unmatched words. Unit tests using
constructed times are not timing-accuracy benchmarks.

Compare Tiny timestamped q4, Base timestamped q4 and Swift q8 on identical audio
with Hindi transcription (not translation), 30s chunks/5s stride. Preserve raw
hypotheses and model-provided timestamps. Report strict and declared
spelling-tolerant WER/CER separately; never attribute scorer normalization gains
to ASR. Record insertion/deletion/substitution counts and technical/proper-noun
errors, recognition-only and end-to-end time. Browser JS heap is not peak
process/WASM memory; use external process measurements for that column.

No Swift-word/Whisper-time transfer is implemented. Valid native word timing is
accepted only when every chunk is bounded, ordered, non-overlapping and a single
word. Missing or invalid timing requests phrase timing instead; it does not
interpolate endpoints or copy positions across different transcripts. This is
structural validation, not manual proof of acoustic timing accuracy.

Production accuracy, Hindi-script reliability and automatic karaoke quality
remain gated on the expanded corpus and annotated timings. Model suggestions
are not a production recommendation until these gates pass.
