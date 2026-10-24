# Architecture

## Data flow and privacy boundary

```
 Browser (user's device)                                     Server (Next.js route handler)
 ───────────────────────────────────────────────            ─────────────────────────────────
 File ─▶ probeFile ─▶ validateProbe ─▶ checkDevice
   │
   ├─▶ extractSpeechAudio ─▶ Ogg Opus mono 32 kbps ──upload──▶ POST /api/transcribe
   │                         (only thing that leaves)            │ content-type, length, rate limit
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

The video never leaves the device. The server keeps no audio or transcript: they live only in
request memory. Logs carry error codes only.

## Modules

| Path | Runs in | Purpose |
| --- | --- | --- |
| `src/lib/captions` | both | `Word`/`CaptionLine` types, grouping, `lineAt`, word wrap, canvas drawing, SRT |
| `src/lib/captions/edit.ts` | both | Pure word edits: replace/split, remove, merge, clamped edge nudges, `wordIndexAt` |
| `src/app/lab/TranscriptEditor.tsx` | browser | Word editor UI with keyboard shortcuts; the lab keeps the edits and undo history |
| `src/lib/media/probe.ts` | browser | Mediabunny metadata read → `ProbeResult` |
| `src/lib/media/validate.ts` | both | Pure limits → `Issue {code, reason, action}` |
| `src/lib/media/capabilities.ts` | browser | WebCodecs/OffscreenCanvas and encoder checks at the real size |
| `src/lib/media/extractAudio.ts` | browser | Mediabunny `Conversion` → Ogg Opus mono |
| `src/lib/media/render.ts` | browser | Mediabunny `Conversion` with `video.process` drawing captions; audio copied |
| `src/lib/transcription/handler.ts` | server | Validation, rate limit, sniff, provider call, error mapping |
| `src/lib/transcription/groq.ts` | server | Groq Whisper adapter (`verbose_json`, word timestamps) |
| `src/lib/transcription/rateLimit.ts` | server | In-memory limiter, salted daily IP hash |
| `src/lib/transcription/client.ts` | browser | `fetch` wrapper and disclosure text |

## Rendering

`renderCaptionedMp4` runs one Mediabunny `Conversion`. Each decoded frame (rotation already baked
in) is drawn to an `OffscreenCanvas`, the active caption line is drawn on top, and the canvas is
re-encoded as H.264. Audio packets are copied when MP4 can hold them (AAC, Opus, MP3), otherwise
transcoded. Output goes to an in-memory buffer with fast start.

It currently runs on the main thread. Moving it to a Web Worker is a Phase 3 task (T-20).

## Error contract

- Client-side media: `Issue { code, reason, action }` (`src/lib/media/types.ts`).
- API: `{ error: { code, message, action } }` with an HTTP status. Codes are listed in
  `src/lib/transcription/handler.ts`.
