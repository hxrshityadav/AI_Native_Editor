# Device log

One row per run on a real device. Never record file names or content. Record clip length,
resolution, codecs, timings and the outcome.

| Date | Device / OS | Browser | Clip (len, res, codecs) | Probe | Extract (time, size) | Transcribe | Render (time) | Result / error code | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-24 | Linux container (CI-like, not a real device) | Headless Chromium 153 | 4 s 720×1280 H.264/AAC (fixture) | OK | OK, 16.7 KB | mocked | ~3.6 s | OK | Automated E2E only |

## How to run on Android

1. On your laptop, run `npm run build && npm run start -- -H 0.0.0.0` (or `npm run dev -- -H 0.0.0.0`).
2. WebCodecs needs a secure context, and a LAN IP over plain http is not one. Use Chrome remote
   debugging port forwarding (`chrome://inspect` → Port forwarding `3000 → localhost:3000`), then
   open `http://localhost:3000/lab` on the phone. Alternatively use an HTTPS tunnel.
3. Use a real clip recorded on that phone. Fill in a row above.
