# Architecture

## Data flow and privacy boundary

```
 Browser (user's device)                                     Server (Next.js route handler)
 ───────────────────────────────────────────────            ─────────────────────────────────
 File ─▶ probeFile ─▶ validateProbe ─▶ checkDevice
   │
   ├─▶ extractSpeechAudio ─▶ Ogg Opus mono 32 kbps ──upload──▶ POST /api/transcribe
   │                         (only thing that leaves)            │ content-type, length,
   │   + Turnstile token header (when on)                        │ Turnstile token present → rate limit
   │                                                             │ (Postgres) → Turnstile siteverify
   │                                                             │ Zod form validation, 4 MB cap
   │                                                             │ byte sniff: audio-only Ogg Opus
   │                                                             ▼
   │                                                        TranscriptionProvider (Groq)
   │                                                             │ words[] (in memory only)
   │   Word[] ◀──────────────────────────── JSON ◀───────────────┘
   ▼
 groupWords ─▶ CaptionLine[] ─▶ preview (canvas overlay) ─▶ renderCaptionedMp4 ─▶ MP4 (local)
                                                       └─▶ toSrt ─▶ SRT (local)
```

The video never leaves the device. Transcripts and edits are saved in the browser's IndexedDB,
keyed by a SHA-256 of the file's size plus its first and last MiB, so no file names are stored. The server keeps no audio or transcript: they live only in
request memory. Logs carry error codes only.

Abuse controls (T-14): `GET /api/transcribe` tells the browser at request time whether a Turnstile
check is on. When it is, the transcribe step loads Cloudflare's script, and each upload sends a
single-use token in `x-turnstile-token`. The server refuses a missing token before it counts the request,
then checks the shared rate limit, then verifies the token with Cloudflare, and only then reads the audio.
Any check it can't complete (database or Cloudflare down) refuses the upload rather than allowing
unmetered spend. On Vercel, transcription stays off unless `DATABASE_URL` and both Turnstile keys are set.

## Modules

| Path | Runs in | Purpose |
| --- | --- | --- |
| `src/lib/captions` | both | `Word`/`CaptionLine` types, grouping, `lineAt`, word wrap, canvas drawing, SRT |
| `src/components/editor/useReelSession.ts` | browser | The whole workflow as one hook (check, extract, transcribe, edits, drafts, style, kit, render, report); `/lab` and `/studio` are layouts over it |
| `src/components/editor/parts.tsx` | browser | Shared pieces: Preview, DataFlow, TranscribeDisclosure, StylePicker, RenderStatus, … |
| `src/app/studio/StudioClient.tsx` | browser | The product UI: desktop three panes, phone step flow |
| `src/lib/media/faststart.ts` | browser | Moves `moov` to the front of a finished MP4 (qt-faststart method), streaming the media data |
| `src/lib/media/exportPresets.ts` | both | Presets and `planExport` (source + preset + framing → output size and fit) |
| `src/lib/captions/edit.ts` | both | Pure word edits: replace/split, remove, merge, clamped edge nudges, `wordIndexAt` |
| `src/app/lab/TranscriptEditor.tsx` | browser | Word editor UI with keyboard shortcuts; the lab keeps the edits and undo history |
| `src/lib/captions/fonts.ts` | both | Bundled caption fonts (`public/fonts`, OFL) and a loader for `document.fonts` or the worker's `self.fonts` |
| `src/lib/captions/styles.ts` | both | The five caption presets; `getCaptionStyle` falls back to the default for unknown ids |
| `src/lib/deviceReport.ts` | browser | Privacy-safe run report (device, clip properties, step timings) and its DEVICE_LOG row |
| `src/lib/brandKit.ts` | browser | The brand kit: Zod schema, `applyBrandKit` (kit on top of a style), load/save |
| `src/lib/localDb.ts` | browser | The single IndexedDB database (v2): `drafts` and `settings` stores |
| `src/lib/drafts.ts` | browser | Caption drafts in IndexedDB (`idb`), keyed by a content hash, Zod-validated on read, pruned to 20 |
| `src/lib/media/probe.ts` | browser | Mediabunny metadata read → `ProbeResult` |
| `src/lib/media/validate.ts` | both | Pure limits → `Issue {code, reason, action}` |
| `src/lib/media/capabilities.ts` | browser | WebCodecs/OffscreenCanvas and encoder checks at the real size |
| `src/lib/media/extractAudio.ts` | browser | Mediabunny `Conversion` → Ogg Opus mono |
| `src/lib/media/render.ts` | browser | Mediabunny `Conversion` with `video.process` drawing captions; audio copied |
| `src/lib/edit/timeline.ts` | both | Edit decision list (Zod), `buildTimeMap`, source↔output time, `mapInterval`/`mapWords` (pure) |
| `src/lib/edit/silence.ts` | both | Level stats and silence suggestions from 10 ms levels (pure) |
| `src/lib/edit/audioLevels.ts` (+ worker, `analyzeInWorker.ts`) | browser | Streams the speech audio through a decoder in a worker → 10 ms levels |
| `src/lib/media/renderEdited.ts` | browser | Export with cuts: decodes only kept segments, re-times frames and samples, captions on output time |
| `src/lib/transcription/handler.ts` | server | Validation, rate limit, sniff, provider call, error mapping |
| `src/lib/transcription/groq.ts` | server | Groq Whisper adapter (`verbose_json`, word timestamps) |
| `src/lib/transcription/sarvam.ts` | server | Sarvam adapter (bake-off): translit mode, phrase timestamps → estimated word times, ≤ 30 s |
| `src/lib/transcription/rateLimit.ts` | server | In-memory limiter (development), salted daily IP hash |
| `src/lib/transcription/pgRateLimit.ts` | server | Shared Postgres limiter (`DATABASE_URL`): atomic upsert per key and hour |
| `src/lib/transcription/humanCheck.ts` | server | Turnstile siteverify → passed / failed / unavailable |
| `src/components/editor/HumanCheck.tsx` | browser | Loads Cloudflare's script on the transcribe step only; token → session |
| `src/lib/transcription/client.ts` | browser | `fetch` wrapper and disclosure text |

## Rendering

`renderCaptionedMp4` runs one Mediabunny `Conversion`. Each decoded frame (rotation already baked
in) is drawn to an `OffscreenCanvas`, the active caption line is drawn on top, and the canvas is
re-encoded as H.264. Audio packets are copied when MP4 can hold them (AAC, Opus, MP3), otherwise
transcoded. It runs in a dedicated module worker (`render.worker.ts`, started by `renderInWorker.ts`). The
worker streams the MP4 into the origin private file system (OPFS) through a Mediabunny
`StreamTarget`, with `fastStart: false` (metadata at the end), so nothing grows in memory with
video length. The worker hands back the OPFS `File`, which stays disk-backed. Without OPFS writes it
falls back to an in-memory `BufferTarget` with fast start, and the UI says so. Cancelling terminates
the worker. The worker loads the style's bundled font into its own `self.fonts` before the first
frame (workers can't see the page's fonts) and fails the render rather than fall back to a system
font. The preview likewise draws no captions until the font has loaded.

## Error contract

- Client-side media: `Issue { code, reason, action }` (`src/lib/media/types.ts`).
- API: `{ error: { code, message, action } }` with an HTTP status. Codes are listed in
  `src/lib/transcription/handler.ts`.
