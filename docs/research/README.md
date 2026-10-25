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

## Groq chat for Hinglish romanization (checked 2026-10-25)

- Structured Outputs (https://console.groq.com/docs/structured-outputs): `strict: true` (constrained
  decoding, schema always matched) works on `openai/gpt-oss-20b`, `openai/gpt-oss-120b`,
  `qwen/qwen3.8-27b` and `meta-models/muse-spark-open`. Strict mode needs every property `required`
  and `additionalProperties: false`. Array length can't be pinned, so we check it ourselves.
- Reasoning (https://console.groq.com/docs/reasoning): GPT-OSS takes `reasoning_effort` low, medium
  or high; `include_reasoning: false` drops reasoning from the response.
- `openai/gpt-oss-120b` price (https://console.groq.com/docs/model/openai/gpt-oss-120b): $0.15 per
  1M input tokens, $0.60 per 1M output; 131k context. A 3-minute clip (~500 words) is roughly 2–4k
  tokens, about $0.001–0.002.
- Why not Whisper `language=en` for Hinglish: Whisper tends to translate non-English speech into
  English rather than transliterate it. To be confirmed on real clips in T-12.

## Vercel (checked 2026-10-24, https://vercel.com/docs/functions/limitations)

- Function request and response bodies are capped at 4.5 MB. This drives D-005.

## Platform upload specs (checked 2026-10-25)

See `platform-uploads.md`: YouTube recommends MP4 with moov at the front, AAC or Opus. Meta's
Instagram, Facebook and WhatsApp specs say AAC. WhatsApp's app defaults to 100 MB and 720p.

## To do

- Sarvam speech-to-text: API, word timestamps?, Hinglish/Roman output, price (T-12).
- Real upload results for the T-13 test pack (`platform-uploads.md`).
- Vercel plan terms for commercial use before charging money.
