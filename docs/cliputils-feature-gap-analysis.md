# ClipUtils feature gap analysis (15 November 2026)

This compares ClipUtils (cliputils.com: `/`, `/tools`, `/pro` and individual tool pages, re-inspected live on 15 November 2026) with this repository as it stands, not with the roadmap. The earlier architecture study is in `docs/research/cliputils-rea-2026-11-03.md`. That study found that ClipUtils runs a mix of local FFmpeg WASM and server processing. Its text-to-speech, "Accurate" subtitles, Shorts Maker and reel scripts use servers or remote LLMs on some or all paths.

No ClipUtils code, copy, branding or assets were used. The comparison covers capabilities only.

## Classification key

- **Implemented:** Reel Finisher does this today with comparable scope.
- **Partial:** a narrower version exists.
- **Missing:** no equivalent exists.
- **Better here:** Reel Finisher's version is stronger, usually on privacy or verified output.
- **Not worth it:** low value, or it conflicts with the product brief.
- **Blocked:** needs a licence, model or product decision first.

Priority follows the brief: P0, P1, P2, or "—" when nothing is planned.

## Matrix

| Feature | ClipUtils capability | Reel Finisher capability | Gap | Priority | Implementation |
|---|---|---|---|---|---|
| **Music mixer / background music** | No standalone mixer in its catalogue; music is added inside the reel generator | **New:** `/tools/music-mixer`. Voice or video plus music, voice and music levels, measured automatic ducking (speech map, 60 ms attack, 400 ms release), fades, music start offset, loop with seam fades, M4A/WAV output, or the video's own container with the picture copied | Better here | P0 | **Done (Tested).** `src/lib/mediatools/mixer.ts`, `MusicMixer.tsx`, 11 unit and 15 E2E checks |
| Audio cutter: waveform, range, fades | Waveform, fades, local FFmpeg WASM | Real decoded waveform, slider and number range, playhead buttons, fades | Implemented | — | Existing |
| Audio cutter: zoomed waveform | Not observed | **New:** zoom, scroll, windowed peaks, keyboard nudging, Play selection | Better here | P0 | **Tested 2026-11-15** (`ZoomWaveform.tsx`) |
| Ringtone (M4R) | M4R output, iPhone ringtone landing page | **New:** M4R format and a 30 s ringtone preset; over 40 s is explained and blocked | Implemented | P0 | **Done (Tested).** `engine.ts` (`m4r`, `RINGTONE_MAX_SECONDS`), `MediaTool.tsx`, 2 E2E checks |
| MP3 output | MP3 everywhere (FFmpeg WASM, LAME) | M4A, WAV, Ogg, M4R; MP3 input only | Blocked | P1 | Browsers have no MP3 encoder. Candidate: `@mediabunny/mp3-encoder` (MPL-2.0 wrapper, based on LAME, which is LGPL; v1.66 vs installed mediabunny 1.62). Needs a licence and size check and a `DECISIONS.md` entry before adding it |
| Audio converter | Many "X to MP3" pages | MP3, WAV, M4A, AAC, Ogg, Opus, FLAC in; M4A, WAV, Ogg out | Partial (no MP3 out) | P2 | Follows the MP3 decision |
| Extract audio from video | Yes | Yes | Implemented | — | Existing |
| Increase volume / normalise | Yes | Gain with a soft limiter, or peak normalisation to -1 dBFS | Implemented | — | Existing |
| Noise remover | FFmpeg RNNoise | RNNoise (124 KB, optional consent) or light spectral DSP | Implemented | — | Existing |
| Vocal remover / minus one | Local MDX-Net ONNX | Stereo centre/side DSP, labelled as not AI | Partial | Blocked | Neural separation needs weights with a clear licence (`docs/local-models.md`). Unchanged |
| Remove music from video | Yes | Centre-channel DSP, labelled honestly | Partial | Blocked | As above |
| **Text to speech, English** | Kokoro on desktop, server elsewhere; MP3/WAV, speed | SpeechT5 + HiFi-GAN (370 MiB, consent), WAV, plus browser speech for listening | Partial | P0 | Speed control and Kokoro English are candidates (see roadmap) |
| **Text to speech, Hindi and Indian languages** | Hindi (6 voices), Tamil, Telugu, Bengali, Marathi and more; server on some paths | English only | Missing | P0 | **Blocked (licence).** kokoro-js's phonemizer covers English only. Kokoro's Hindi path and Piper both need espeak-ng (GPL-3.0); Piper's maintained engine is GPL-3.0. A browser Hindi voice needs either a GPL decision or a phonemizer-free model. See roadmap |
| Hinglish input | Yes | No | Missing | P1 | Depends on Hindi TTS |
| Subtitles / captions | Local Whisper or server "Accurate" (Groq) | **New:** Subtitle Studio. Local Whisper Tiny, caption editor, five styles, Devanagari fonts, preview equal to export, SRT/VTT/burned-in MP4 | Partial (no word timing) | P1 | **Tested 2026-11-15.** Word-level timing is not available from the current model |
| Hindi / Hinglish subtitles | Yes (server for best accuracy) | **2026-11-15:** real language ID (the old default forced English), explicit Hindi mode, Hinglish with Roman or Devanagari script, Tiny or Base with word timing | Partial (accuracy unmeasured on real Hindi) | P1 | Real-Hindi benchmark pending approval of a dataset download |
| Video translator / dubbing | Translate and dub, multiple languages | English subtitles; other languages via the Chrome Translator API; English SpeechT5 dub | Partial | P1 | Non-English dubbing needs multilingual TTS (blocked above) |
| **AI Reel Generator** | Topic → AI script (remote LLM, about 5 free per day) → voice → word captions → MP4 | Text to Video (script cards + SpeechT5 narration, MP4), no idea generation | Partial | P1 | Planned: local template hooks and scripts first; an optional remote LLM only with disclosure and consent. Not built in this pass |
| Shorts Maker (long → short clips) | Remote Claude picks highlights | Removed with the Studio on 2026-11-08 | Missing | P1 | Rebuild on the tool surface: local transcript → ranked segments → 9:16 crop and export. Not built in this pass |
| Video compressor / to size | Yes, plus 10/25 MB pages | Compressor and Compress to Size with a measured result | Better here | P2 | Presets (10/25 MB, Discord, WhatsApp) as landing pages |
| Convert to MP4 | MOV/WebM/MKV → MP4 | Yes, with stream copy when possible | Implemented | P2 | Landing pages only |
| Trim video, remove audio, video to GIF | Yes | Yes | Implemented | — | Existing |
| Audio to video / waveform video | Yes | Measured-level visualiser MP4 | Implemented | — | Existing |
| Image to video | Paid server generation | Local photo animations, labelled as not generative | Partial | Not worth it | Generative video needs servers and payments, which the brief excludes |
| Photo tools (compress, resize, convert, HEIC, background, passport) | Not ClipUtils' focus | Six photo tools | Better here | — | Existing |
| PDF to audio, lecture notes | Not offered | Yes | Better here | — | Existing |
| Watermark on free exports | Watermark-free with Pro upsells | Never watermarked | Better here | — | Rule |
| Accounts, Pro tier, credits | Yes | None | Not worth it | — | Out of scope |
| SEO conversion landing pages | About 70 "X to Y" and language pages | One page per tool | Missing | P2 | Only where the page is a real preset of an existing engine with unique content; no thin pages |

## Summary

- **Done:** the Music Mixer (P0), M4R ringtone export and the zoomable waveform (P0 Audio Cutter), and Subtitle Studio (P1, phrase-level timing).
- **P0 left:** multilingual TTS is deferred. The owner chose to stay local-only and wait (see `DECISIONS.md`, 2026-11-15). A local Hindi voice needs a GPL-compatible distribution decision or a different model. MP3 output (also a licence decision) is planned.
- **P1 and P2:** not started.
