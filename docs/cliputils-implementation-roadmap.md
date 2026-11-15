# ClipUtils gap roadmap (15 November 2026)

This roadmap sequences the gaps listed in `docs/cliputils-feature-gap-analysis.md`. Statuses follow `TASKS.md`. Every item keeps the product rules:

- Media stays on the device.
- Model downloads need consent.
- There is no silent cloud fallback.
- No fake progress.
- Each failure gives a reason and a recovery action.
- Free exports have no watermark.

## Phase P0

### Music Mixer: Tested

- **Engine:** `src/lib/mediatools/mixer.ts`, which runs in the existing media worker as the `mix` request kind.
  1. Decode the voice and measure RMS per 20 ms window.
  2. Find speech: the threshold is the noise floor (10th percentile) + 10 dB, clamped to -50…-20 dBFS, with 120 ms of pre-roll and 350 ms of hold.
  3. Build the ducking curve: a one-pole filter in dB with a 60 ms attack and a 400 ms release, interpolated per sample.
  4. Decode the music from its start offset and resample it linearly to 48 kHz stereo, using bounded Int16 memory of about 11.5 MB per minute.
  5. Loop the music with 15 ms cosine seams when it is shorter than the voice.
  6. Mix in Mediabunny's conversion `process` hook, followed by a soft limiter.
  7. For video, copy the picture track and re-encode only the audio: AAC for MP4/MOV/MKV, Opus for WebM. Audio-only sources produce M4A (AAC 192 kbps) or WAV.
  8. Re-inspect the output, checking that it has audio and a matching length.
- **UI and route:** `src/components/media/MusicMixer.tsx` and `/tools/music-mixer`, with a catalog entry (Audio category, so it appears in the Command Center and the palette automatically) and a sitemap entry.
- **Tests:**
  - `tests/unit/mixer.test.ts` (11 checks): speech detection, an adaptive floor, curve depth, attack faster than release, smoothness, resampler length and frequency, capacity, seam fades and option validation.
  - `tests/e2e/mixer.e2e.mjs` (15 checks): a real M4A, WAV and MP4 measured with ffmpeg. The music band measured -23.6 dB without speech and -35.5 dB during speech (11.9 dB of ducking at the 12 dB setting), and recovered to -24.3 dB afterwards. The 4 s MP3 loops across 10 s. The video's frames are copied (300 of 300). Also covered: validation, cancellation, no exceptions, same-origin requests only.
- **Limits:**
  - The voice file must have an audio track.
  - Ducking measures loudness, not voices. Constant loud noise in the voice recording weakens speech detection.
  - Inputs up to 10 minutes and 512 MiB.
  - MP3 is accepted as input only.

### Audio Cutter: M4R ringtone and the zoomable waveform are Tested

- **Done:**
  - An `m4r` audio format: AAC in MP4 with the `.m4r` extension and fast start.
  - A 40 s limit enforced in the engine, with a reason, and in the UI with a warning and a disabled button.
  - A "Ringtone preset: 30 s, M4R" button (30 s from the start point, 0.5 s fade in, 1.5 s fade out).
  - FAQ and steps updated.
  - E2E: a 30.0 s AAC `.m4r` from a 50 s MP3, and the over-40 s selection is blocked.
- **Done (2026-11-15):** zoomable, scrollable waveform (`ZoomWaveform.tsx`, `waveformView.ts`).
  - The file is decoded once into fine peaks (50 per second, up to 30,000), and zooming reduces those in the page.
  - When the visible window holds fewer fine peaks than the 600 bars on screen, a debounced worker request decodes only that window (`peaks` with `window: { start, end, buckets }`).
  - Keyboard nudging on the edge handles: arrows 0.1 s, Shift 1 s, Alt 0.01 s, PageUp/PageDown 5 s, Home/End. The edges can never cross.
  - Play selection stops exactly at the selection end.
  - Tests: 8 unit and 21 E2E checks, including a 14.50 s `.m4r` export that matches a selection made after zooming.
- **MP3 output: Blocked (licence decision).** Browsers do not encode MP3. The most direct candidate is `@mediabunny/mp3-encoder`. On npm it is version 1.66.0, MPL-2.0, and described as "based on LAME". LAME itself is LGPL.
  - Before adding it, confirm the bundled LAME licence terms, the WASM size, worker compatibility and cancellation behaviour.
  - Also confirm compatibility with the installed mediabunny 1.62. An upgrade may be needed and should be checked with the full media E2E suite.
  - Record the choice in `DECISIONS.md`.

### Multilingual text to speech: Deferred (decided 2026-11-15: stay local-only and wait; see `DECISIONS.md`)

Findings, checked on 15 November 2026 (sources are recorded in `docs/research/README.md`):

| Candidate | Languages | Licence | Size | Browser | Verdict |
|---|---|---|---|---|---|
| Kokoro-82M (kokoro-js, Transformers.js) | The JS phonemizer supports **English (US, UK) only**. The Python model has Hindi voices through misaki/espeak | Apache-2.0 weights; the non-English G2P relies on espeak-ng (GPL-3.0) | 82 M parameters, about 80–330 MB depending on quantisation | Yes (WASM/WebGPU) | Usable for **English** without GPL code. Hindi is not available in the browser without espeak-ng |
| Piper (OHF-Voice/piper1-gpl) | 20+ languages, including Hindi voices | Engine **GPL-3.0-or-later**; espeak-ng GPL-3.0; each voice has its own licence | About 25–65 MB per voice (some about 100 MB) | Community WASM ports | Blocked on GPL distribution and per-voice licences |
| SpeechT5 (current) | English | MIT | 370 MiB with consent | Yes | Keep until a replacement is benchmarked |
| Browser `speechSynthesis` | OS voices, often including Hindi | — | 0 | Yes, but there is no audio capture API | Listening only; it cannot produce a download honestly |

Decision needed (yours): either accept GPL-3.0 for a separately loaded TTS worker, which needs legal review of the WASM distribution, or wait for a phonemizer-free multilingual model. Until then SpeechT5 stays, and no Hindi download is offered. A cloud TTS is possible only as an explicit, disclosed, consented option with server-side keys, and the brief prefers local.

Lower-risk next step: **Kokoro English** as a second, smaller and faster English voice. That needs a side-by-side benchmark against SpeechT5 (size, real-time factor, a Whisper round-trip intelligibility check like the one used for SpeechT5) before it replaces anything.

## Phase P1: Subtitle Studio done; the rest Not started

- **AI Reel Generator:**
  1. Generate hook and script drafts locally from templates and the user's own topic text.
  2. Narrate with the existing TTS.
  3. Add Whisper word-timed captions.
  4. Produce a 9:16 MP4 with the existing Text to Video renderer and the Music Mixer engine for background music.
  - An optional remote LLM for scripts only after a disclosure and consent screen, with keys kept server-side and no media sent. No "AI" badge on template output.
- **Advanced Subtitle Studio: Tested (2026-11-15)** at `/tools/subtitle-studio`. Local Whisper Tiny transcription with consent, or captions written by hand, then editing (text, timing, split, merge, add, delete, undo/redo, shortcuts), five presets, and SRT, VTT or a burned-in H.264 MP4. See `docs/subtitle-studio-and-unslop-report.md`.
  - **Not done:** word-level timing. The Whisper Tiny export returns phrase timestamps, so the Highlighted word preset stays disabled. The renderer already supports real word timings when a model provides them, for example the `onnx-community/whisper-tiny_timestamped` variant, which would need its own consent, revision pin and benchmark.
  - **Not run:** the Hindi and Hinglish accuracy gate (Tiny vs Base WER/CER on real clips). No Hindi reference clips are in the repo, and Whisper Base needs a separate consented download. Hindi is not advertised as accurate.
- **Shorts Maker (rebuild):** transcript → ranked candidate segments (silence, speech density, keyword hits; no fake "virality" score) → 9:16 crop → export. It must be rebuilt on the shared tool surface, since the Studio was removed.

## Phase P2: Not started

- Preset landing pages, only where each is a real preset with unique copy: Compress video to 10 MB and to 25 MB (Discord), WhatsApp video, MOV to MP4, WebM to MP4, iPhone ringtone maker (the Audio Cutter with the preset preselected).
- No "X to MP3" pages until MP3 output exists.
