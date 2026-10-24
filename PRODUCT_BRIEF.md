# Product brief: Reel Finisher (working name)

## What it is

A browser-first tool that turns a raw talking-head video into a captioned, on-brand Reel or Short.
The video stays on the user's device.

Workflow: pick a video → check file and device → extract speech audio locally → transcribe with
word timings → edit transcript → apply style or brand kit → preview → export a watermark-free MP4
and an SRT file.

## Initial market (unproven)

Indian creators and Reel editors captioning in Hindi, Hinglish and English.

Treat the target user and willingness to pay as hypotheses. Likes, waitlists and AI market
estimates are not evidence. Real payments, repeat exports and interviews are.

## Why it might win

- Privacy: the video never uploads, so it's fast on slow uplinks and safe for unreleased content.
- Hindi/Hinglish captions that look right (Devanagari shaping, Roman-script Hinglish option).
- No watermark on free exports.

## Metrics to track (cookieless, no content)

Visitors who start processing · successful exports · time to first export · failed-run rate (by
error code) · repeat exports within 7 days · paid conversion · refunds · variable cost per export.

## Variable cost per export (assumptions, rechecked 2026-10-24)

- Groq `whisper-large-v3`: $0.111 per audio hour, minimum 10 s billed per request.
  A 60 s Reel costs ~$0.0019; a 3-minute clip costs ~$0.0056.
- `whisper-large-v3-turbo`: $0.04 per hour (~$0.002 per 3-minute clip), lower accuracy.
- Rendering is on-device, so it costs us nothing.
- Hosting and bandwidth are negligible per export: the upload is ~0.24 MB per minute of audio.

Recheck provider rates before using them for pricing. Sources: `docs/research/README.md`.
