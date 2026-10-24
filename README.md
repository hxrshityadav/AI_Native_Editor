# Reel Finisher

Browser-first tool that turns a raw talking-head video into a captioned Reel or Short. The video is
processed locally with WebCodecs. Only compressed speech audio is sent for transcription.

Status: Phase 2 technical proof of concept. See `TASKS.md`.

## Run locally

```bash
npm install
cp .env.example .env.local   # then set GROQ_API_KEY
npm run dev                  # open http://localhost:3000/lab
```

## Checks

```bash
npm run check   # typecheck, lint, unit tests
npm run build
npm run e2e     # after build; needs ffmpeg + ffprobe
```

Agents and contributors: read `CLAUDE.md` first.
