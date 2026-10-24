# Research notes

Facts we rely on, with source and date checked. Recheck before pricing or launch decisions.

## Groq speech-to-text (checked 2026-10-24, https://console.groq.com/docs/speech-to-text)

- Endpoint: `POST https://api.groq.com/openai/v1/audio/transcriptions`, OpenAI-compatible.
- Models: `whisper-large-v3` ($0.111/h, WER 10.3%), `whisper-large-v3-turbo` ($0.04/h, WER 12%, no translation).
- Limits: 25 MB upload on the free tier (100 MB on the dev tier); minimum billed length 10 s.
- Formats: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm. Only the first audio track is used.
- Word timings: `response_format=verbose_json` + `timestamp_granularities[]=word` → `words[{word,start,end}]`.
- `language` takes ISO-639-1 (we send `hi`, `en`, or omit for auto). `prompt` (≤224 tokens) can steer
  spelling or style. Worth testing for Hinglish in T-12.
- Not yet verified: Groq's data retention for audio inputs. Read their privacy policy and terms
  before launch and update the disclosure if needed.

## Vercel (checked 2026-10-24, https://vercel.com/docs/functions/limitations)

- Function request and response bodies are capped at 4.5 MB. This drives D-005.

## To do

- Sarvam speech-to-text: API, word timestamps?, Hinglish/Roman output, price (T-12).
- Instagram, YouTube and WhatsApp acceptance of H.264 + Opus in MP4 (T-13).
- Vercel plan terms for commercial use before charging money.
