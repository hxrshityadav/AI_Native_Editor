# Hinglish bake-off (T-12)

Question: which gives creators the best Roman-script Hinglish captions? The candidates are Groq Whisper
plus our romanizer (current default), Sarvam `saaras` in translit mode, and the free baseline creators already
have, Instagram Edits' auto captions.

## What's compared

| | Groq (current) | Sarvam | Instagram Edits |
| --- | --- | --- | --- |
| Route | Whisper `whisper-large-v3` (Hindi) → `gpt-oss-120b` romanizes word by word | `saaras:v3`, `mode=translit`, one call | In the Edits app |
| Word timings | From Whisper | **Estimated** inside each phrase (API gives phrase timestamps only) | n/a (not compared) |
| Clip length | ≤ 3 min | ≤ 30 s per REST call (Batch API for longer, not built) | App limits |
| Price per 3 min | ~$0.0056 + romanizing tokens | ₹1.47 | Free |
| Trains on audio by default | Not verified (to check before launch) | **Yes, unless opted out** | Meta's terms |

Sources and dates: `docs/research/README.md`.

## Measured so far

Nothing on real speech yet. That needs clips, references and keys. Done in this container:
- **Sarvam adapter:** unit-tested against Sarvam's documented request and response shapes. No live call,
  because api.sarvam.ai is blocked here.
- **Harness dry run:** clips are cut to 30 s, providers without a key are skipped with the reason, and the
  Edits text is scored (WER 50% and lenient CER 9% for "aaj ham ek acha reel banaenge" against "aaj hum ek
  accha reel banayenge").

## Protocol

1. **Opt the Sarvam account out of training first** (dashboard settings, or email privacy@sarvam.ai), then
   set `SARVAM_TRAINING_OPT_OUT=confirmed`. Use only clips whose speakers agreed to this.
2. In `.env.local`: `GROQ_API_KEY`, `SARVAM_API_KEY`, `SARVAM_TRAINING_OPT_OUT=confirmed`.
3. Pick 10 clips. Each is scored on its first 30 s, so pick clips where speech starts early. Suggested mix:
   - 4 everyday Hinglish talking heads;
   - 2 mostly Hindi;
   - 2 English-heavy (product names, tech words);
   - 1 fast or excited speech;
   - 1 noisy (street or fan).
4. For each `clip.mp4`, write `clip.ref.txt`: what is said in the first 30 s, in Roman Hinglish as a
   creator would type it. Listen twice. This is the slow part (about 5 minutes per clip).
5. Optional: run the same clip through Instagram Edits' auto captions and type or paste its captions
   for the first 30 s into `clip.edits.txt`.
6. `npm run build`, then `npm run bakeoff -- path/to/clips`. That makes 20 billable calls; the cost is about ₹15 for Sarvam
   plus a few paise for Groq.
7. Read `tests/bakeoff/.out/report.md`. It has scores and every transcript side by side, and is gitignored.
   Copy the summary table, without transcripts, into the results below.
8. Watch 2–3 Sarvam clips with karaoke highlighting in `/studio` (`TRANSCRIBE_PROVIDER=sarvam npm run start`)
   to judge whether estimated word timing looks acceptable.

## How to decide

- Text first: pooled lenient CER, then WER. A gap under ~2 points is noise at 10 clips.
- No Hindi script left in Hinglish captions ("Hindi-script words" = 0%).
- Sync: phrase starts within ±150 ms at the same bar as T-11.
- If Sarvam wins clearly on text: next steps are its Batch API for clips over 30 s, and possibly a hybrid
  (Sarvam text, Groq word timings). Neither is built. Price is about 3× Groq but still about ₹1.5 per clip.
- If Groq is as good or better: keep it, and spend effort on the romanizer prompt instead.

## Results

Not run yet.

| Provider | Clips OK | WER | Lenient CER | Scored clips | Hindi-script words | Sync ±150 ms | Median time | Price / 3 min |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
