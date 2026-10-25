# Caption sync (T-11)

Goal: caption words start within ±150 ms of the speech they show, on 10 real clips.

## Method

Caption timing comes from Groq Whisper word timestamps on the speech audio the app extracts. Two
things can shift it: the extraction step (decode, resample, Opus encode) and the model's word
timings. We measure both against the clip's own audio, with no hand labelling.

1. Decode the clip's first audio track to mono 16 kHz with ffmpeg.
2. Find speech onsets after pauses: 10 ms frame energy, threshold = noise floor (10th percentile) +
   12 dB, gaps under 250 ms bridged, blips under 120 ms dropped.
3. Pair each onset with the nearest **phrase-initial** caption word (the first word, or a word after
   a ≥ 150 ms gap in the word timings) within 600 ms. Error = word start − onset; positive means the
   caption is late. Matching any word instead would let a caption that is early by a word's length
   pair with the next word and hide the error (a unit test covers this).
4. Report per clip and pooled: share within ±150 ms, median and p90 absolute error, and mean signed
   error (bias).

Limits of the method:
- It only checks phrase starts, not every word. Mid-phrase drift between pauses isn't measured.
- An energy detector can mark a soft onset (an unvoiced consonant such as "s", "f" or "h") a few tens of
  ms late, which reads as a small negative bias. Treat |bias| under ~30 ms as noise.
- Music, crowd or wind lowers the signal-to-noise ratio and breaks onset detection. Clips under
  20 dB SNR are reported but excluded from the pooled result.

Code: `tests/sync/syncMetrics.mjs` (pure, unit-tested in `tests/unit/syncMetrics.test.ts`) and
`tests/sync/sync-check.mjs` (the CLI).

## Self-test (2026-10-25, this container, no API key)

`npm run sync-check -- --self-test` generates an 8 s H.264/AAC MP4 with noise phrases at known times,
then:

| Check | Result |
| --- | --- |
| Onsets found in the AAC/MP4 audio at the planted times (±20 ms) | PASS: errors 0, 0, 10, 10 ms |
| The app's own extracted Opus (from `/lab` in Chromium) keeps source timing (±20 ms) | PASS: drift 0, −10, 0, 0 ms |
| A planted +120 ms caption delay is measured as +120 ms | PASS: median 120 ms, bias 115 ms |

This shows that the measurement works and that our extraction adds no measurable offset. It says
nothing yet about Whisper's word timing on real Hinglish speech.

## Real-clip protocol

Needs `GROQ_API_KEY` in `.env.local` (server only; the E2E and self-test servers blank it).

1. Collect 10 phone clips, 20–90 s each, with the creator's consent. They stay on this machine.
   Aim for a mix:
   - 3 in a quiet room;
   - 2 outdoors or in a noisy room;
   - 1 with background music;
   - 2 with fast or excited speech;
   - 2 mostly English;
   - everything else Hinglish.
2. `npm run build`, then `npm run sync-check -- path/to/clips` (`--language=hi` or `--language=en`
   to override the default `hinglish`).
3. The script re-encodes each clip to the same Opus the app sends (mono, 48 kHz, 32 kbps). It then
   transcribes through our `/api/transcribe` and writes `tests/sync/.out/report.md` plus each
   transcript's words JSON. All of this is gitignored and holds transcripts, so don't commit or
   share it.
4. Spot-check two clips by eye in `/studio`: play them and watch whether captions lead or lag.
5. Copy the table and pooled line from the report (clip names replaced by the mix category) into
   the results below.

**Proposed pass bar:** at least 90% of phrase starts within ±150 ms and |bias| ≤ 50 ms, pooled over
clips with SNR ≥ 20 dB. If bias fails but spread passes, a constant offset in `groupWords` is the
fix. If spread fails, compare providers in T-12.

## Results

Not run yet: it needs real clips and a Groq key.

| Clip (category) | Phrases | Within ±150 ms | Median abs (ms) | P90 abs (ms) | Bias (ms) | SNR |
| --- | --- | --- | --- | --- | --- | --- |
