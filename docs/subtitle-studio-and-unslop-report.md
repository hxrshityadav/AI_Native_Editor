# Subtitle Studio, zoomable waveform and unslop pass (15 November 2026)

Uncommitted, on branch `redesign/site-and-tool-workspace`. Statuses follow `TASKS.md`.

## 1. Audio Cutter: zoomable waveform (Tested)

- **Files:**
  - `src/components/media/ZoomWaveform.tsx` and `ZoomWaveform.module.css`: the component.
  - `src/lib/media/waveformView.ts`: pure view, reduction and nudging maths.
  - `engine.ts`: `audioPeaks` takes `{ start, end, buckets }`, `MEDIA_LIMITS.maxPeaks`.
  - `media.worker.ts`, `MediaTool.tsx`: wiring.
- **Peaks:**
  - The file is decoded once at load into fine peaks: 50 per second, from 800 up to 30,000.
  - Zooming reduces those in the page, with no worker and no decoding.
  - When the visible window holds fewer fine peaks than the 600 bars on screen, one debounced (200 ms) worker request decodes only that window. Mediabunny's `samples(start, end)` decodes just that range, never the whole file again.
- **Controls:**
  - Zoom in and out, show the whole file, zoom to the selection, a scroll slider, and Ctrl+wheel zoom around the pointer.
  - Draggable edge handles that are `role="slider"`.
  - Click to move the playhead.
  - Play selection, which stops exactly at the end of the selection.
- **Keyboard on the edge handles:** arrows 0.1 s, Shift 1 s, Alt 0.01 s, PageUp/PageDown 5 s, Home/End. The edges can never cross (minimum 0.1 s).
- **Unchanged:** the existing range sliders and number fields, the ringtone preset and the 40 s M4R limit all work as before. Export uses the same `start`/`end` state as playback.
- **Two bugs found by the E2E test and fixed:**
  - The scroll slider's `step` snapped its maximum short of the file end; it now uses `step="any"`.
  - A seek during playback cancelled the playhead loop, so Play selection never stopped. A seek during playback now keeps the loop running, with `timeupdate` as a backstop.
- **Tests:**
  - `tests/unit/waveform-view.test.ts`: 8/8.
  - `tests/e2e/cutter-zoom.e2e.mjs`: 21/21. It covers zoom bounds (0.5 s minimum, 60 s and 3 s files), scrolling to the exact end, windowed detail peaks, every nudge step, the end blocked from passing the start, playback stopping at the selection end (measured 25.99 s), a 14.50 s AAC `.m4r` from a zoomed and nudged selection, the 40 s limit, cancellation and privacy.

## 2. Subtitle Studio (Tested), `/tools/subtitle-studio`

### Workflow

1. Upload a video. It is validated by the existing `inspectMedia`: 10 minutes, 512 MiB, 4K and decodability.
2. Get captions in one of two ways:
   - **Transcribe locally:** the existing Whisper Tiny worker (`speech.worker`), the only ASR engine. It needs explicit consent that states the 91 MiB download, uses the existing versioned model cache and reports measured progress. Cancellation terminates the worker.
   - **Write captions by hand:** no download.
3. Edit captions: text, start and end, "start/end at playhead", split at the text cursor, merge with next, delete, add at the playhead (or the next free gap).
   - Undo and redo keep 200 steps; typing is grouped per pause.
   - Shortcuts: Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y, Alt+↑/↓, Ctrl+Enter.
   - Timing is clamped between the neighbouring captions, so overlaps cannot be made by editing. Validation flags empty captions, out-of-range times and unsupported scripts.
4. Style: five presets (Clean, Bold, Highlighted word, Boxed, Minimal subtitle).
   - Font: six bundled OFL faces. Poppins, Mukta, Hind and Baloo 2 cover Latin and Devanagari; Anton and Geist are Latin only.
   - Also adjustable: size, text and highlight colour, outline, background (none, a box per line, one band), alignment, vertical position, words per line, and a short fade-in.
   - Wrapping uses both the word limit and the safe-area width. The caption block is always clamped inside the title-safe area (6% sides, 8% top, 14% bottom).
5. Preview: the real video with a canvas overlay drawn by the same `drawCaption` as the export, at the export resolution, plus optional safe-area guides. The preview never draws in a fallback font.
6. Export:
   - SRT or VTT, built at click time.
   - A burned-in H.264 MP4 through Mediabunny `Conversion` with a `video.process` hook in the media worker. Original, 1080p or 720p sizing uses the video compressor's `videoPlan`. Audio is copied if it is already AAC, otherwise encoded to AAC.
   - The output is re-inspected (codec, size, duration, audio present) before any download appears.
   - A result made from older captions is withdrawn, and the studio asks you to export again.

### Shared model

The caption model lives in `src/lib/subtitles/captions.ts`: operations, validation, scripts, presets, layout, `drawCaption`, and SRT/VTT. The burn engine is `src/lib/subtitles/burn.ts`, and the UI is `SubtitleStudio.tsx` with `SubtitleStudio.module.css`. The route and its FAQ copy are in `src/app/tools/subtitle-studio/page.tsx`, with catalog and sitemap entries.

### Word timing (not implemented, by design)

The Whisper Tiny export returns phrase timestamps. The model and renderer support real per-word timings: spoken-word colour, and splits at real word times. The Highlighted word preset stays disabled, with the reason shown, until a transcript carries them. No even-split guessing is used (`DECISIONS.md`, 2026-11-15). The candidate is a timestamped Whisper export, which needs its own consent, revision pin and benchmark.

### Hindi and Hinglish gate (not run)

No Hindi reference clips with transcripts are in the repository, and Whisper Base needs a separate consented download. Hindi is offered as a language with an explicit "accuracy not measured" warning. Devanagari editing, rendering and SRT/VTT are tested. Hindi TTS stays deferred.

### Tests

- `tests/unit/captions.test.ts`: 16/16, covering editing, timing clamps, splitting with and without word timings, gaps, validation, script detection, wrapping, safe-area clamping, drawing, word highlighting only with real timings, and SRT/VTT.
- `tests/e2e/subtitle-studio.e2e.mjs`: 25/25. The checks:
  - Rejection with a reason, the consent gate and no model request before consent.
  - Adding at the playhead, split, undo, redo, Ctrl+Z, the timing clamp, add and delete.
  - The preview drawing during a caption and blank between captions.
  - A Latin-only font blocking Devanagari export, and the disabled word-highlight preset.
  - Exact SRT and VTT text.
  - An H.264 720×1280 AAC MP4 at 8.00 s. Captions are present in the frames during cues (difference 6.12 and 4.53 for Devanagari) and absent between them (0.00).
  - **Preview and export caption boxes identical** (199,966)–(520,1029).
  - Stale-result handling, cancellation, the silent-video explanation, and a phone layout with no overflow and 40px tabs.
  - No exceptions, same-origin requests only.
- With `SUBTITLE_INFERENCE=1`: 26/26. Real Whisper Tiny captioned generated English speech in 33.6 s, including the model load.

## 3. Website-wide unslop pass

### Skill

[unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky, CC BY 4.0, commit `620163e`.

- It was already installed in this project as a verbatim copy of the official repository's `skills/unslop`: `.claude/skills/unslop` for Claude Code and `.agents/skills/unslop` for Codex. It is recorded in `.claude/skills/SOURCES.md`.
- The plugin route (`claude plugin install unslop@heydamir`) was not added. The upstream README says a local copy shadows the plugin, so two copies would conflict.
- The skill was invoked through the Skill tool and its workflow was followed:
  1. Audit against `references/signs.md`.
  2. Decide the scope (light slop, so polish mode).
  3. Direction.
  4. The passes.
  5. Check.

### Direction

- **Product:** in-browser media finishing tools for creators who won't upload their files.
- **Character:** exact, nocturnal, workmanlike.
- **World:** an edit bay at night: scopes, waveforms, a playhead.
- **Moments:** the finishing bench on the home page, and the real waveform or preview in each tool.
- **Signature:** measured file facts in Geist Mono (formats, sizes, times).

### Route inventory

35 public routes: home, `/tools`, `/command-center`, `/privacy`, `/supported-formats` and 30 tool pages (`output/ui-sweep-*/routes.json`). The sweep (`tests/e2e/ui-sweep.e2e.mjs`) measured each at 1920, 1440, 1280, 1024, 768, 390 and 375px, 245 checks in all, with screenshots at 1440, 768 and 390.

### Findings and fixes

| Finding (measured) | Before | After | Fix |
|---|---|---|---|
| Spacing values off the 4px grid | 3,772 | 754 (700 intentional 6px centring in the logo badge and rail capsule; 54 `margin:auto` pushes) | 97 declarations in `public-site.css`, `command-center.css` and `ToolSurface.module.css` snapped to `--space-*` |
| 700-weight text | 4 distinct (logo, Command Center steps) | 0 | `strong`/`b` at 600; logo badge at 600 |
| Negative tracking on small text | 595 | 0 | `.meta` letter-spacing 0; wordmark `tracking-tight` removed |
| Unstyled 13px checkboxes | 3 tools | 18px accent-colour boxes | Global `.site input[type=checkbox]` rule |
| Tool header: privacy badge 7px below the format list | All tool pages | Aligned | The `.tool-meta` row owns the spacing |
| Command Center below 1024px: the rail sat 112px down over the content | 768/390/375 | Fixed | `top:auto` on the in-flow rail |
| `/tools` on phones: two-column cards broke names mid-word ("Vide o Tran slat or") | 390/375 | One column | Container query at 600px and badge `nowrap` |
| Headline with a trailing period | Home | Removed | — |
| Emoji, hue gradients, glows, looping motion, `transition-all`, hover scale | None found | — | Kept as is |
| Page overflow and page errors | 0 | 0 | — |

### Remaining issues

- The "privacy notes" inline link is 16px tall. It's an inline text link, which is exempt from target size.
- The Command Center palette entrance animation is defined in both `command-center.css` and `public-motion.css`. It is duplicated but harmless.
- Pre-rendered category illustrations keep their warm highlights.

## 4. Verification

- **`npm run check`:** typegen, `tsc`, ESLint, Vitest 119/119.
- **Production build:** `next build --webpack` succeeded. It was built without the clean step so the user's dev server could keep running.
- **E2E, each suite run separately (not one `npm run e2e` chain):**

  | Suite | Result |
  |---|---|
  | site | 159/160, then a rerun (see below) |
  | redesign | 93/93 |
  | command-center | 15/15 |
  | photos | 44/44 |
  | passport | 13/13 |
  | heic | 11/11 |
  | background | 13/13 |
  | video-compressor | 37/37 |
  | media | 45/45 |
  | mixer | 15/15 |
  | cutter-zoom | 21/21 |
  | subtitle-studio | 25/25 |
  | localtools | 39/39 |
  | notes | 14/14 |
  | pdf-audio | 20/20 |

  The site failure was the home-page workflow chip "Noise Remover" measured under 32px at 320px during the entrance animation. A direct probe measured exactly 32px, and the rerun after the final CSS fixes passed: site 160/160, command-center 15/15, redesign 93/93.
- **Not run:** `e2e:models` (the model-cache suite) and real-model SpeechT5 inference.
- **Visual:** screenshots reviewed before and after for home, `/tools`, Command Center, Audio Cutter, Image Compressor, Text to Video and Subtitle Studio, at desktop, tablet and phone widths.
- **Pending:** physical phone and tablet checks.

## 5. Dependencies, models and licences

- **New npm dependencies:** none.
- **New models:** none. Subtitle Studio reuses the existing pinned Whisper Tiny.
- **Fonts:** existing bundled OFL files only.
- The unslop skill is CC BY 4.0, with attribution kept here, in `DESIGN.md` and in `SOURCES.md`.
- No GPL code was added, no MP3 encoder, no remote transcription, and no cloud TTS.

## 6. Follow-up: document scrolling (scrollbar at the viewport edge)

- **Root cause:** `.shell-content` was pinned to the viewport height, and `.shell-scroll` inside it had `overflow:auto`. That inner region was the only scroller, so its scrollbar was drawn inside the rounded frame.
- **Fix** (`public-site.css`, `SiteShell.tsx`):
  - The document scrolls; `.shell-scroll` no longer scrolls and is no longer a focusable region.
  - The header is sticky at the frame inset, with a `::after` strip that keeps the 20px header/content gap clear.
  - The rail is sticky at the frame inset.
  - The fixed `.frame-mask` returns on desktop, so the frame corners stay rounded.
  - `scroll-padding-top` is 112px on desktop and 80px on phones.
  - The native scrollbar is thin, with a quiet thumb on the page colour.
- **Real browser** (in-app Chrome, production build):
  - The scrollbar gutter is 10px at the viewport's right edge, and the frame ends 24px inside it.
  - The capsule stays at y108 while scrolled.
  - Hover expansion still resizes the content by 144px while scrolled.
  - Phone and tablet widths have a sticky header and no overflow.
- **Tests:**

  | Suite | Result |
  |---|---|
  | `scrollbar.e2e.mjs` (new) | 178/178 |
  | `header-spacing.e2e.mjs` (rewritten for document scrolling) | 872/872 |
  | site | 160/160 |
  | command-center | 15/15 |
  | redesign | 93/93 |

- **Not passing, and stale:** `capsule-navigation`, `dynamic-sidebar`, `hover-sidebar` and `sidebar-layout` assert the pre-spacing-pass geometry (a 72px column and a 208px expanded rail). The current design is 80px and 224px. They are not in the `npm run e2e` groups and need their expected values updated. That was not done here.

## 7. Caption Generator 2.0 (Subtitle Studio)

**Diagnosis.**
- Transformers.js 3.8.1 does not implement Whisper language identification. Without a language it silently decodes
  with `<|en|>`; the warning is stripped by the build.
- The studio's default "Detect automatically" sent no language, so Hindi speech was decoded as English, which comes
  out as English text and often a translation.
- Translation mode was not the cause (captions always used `transcribe`), and neither was Devanagari rendering. Tiny's
  general weakness on Hindi and Hinglish adds to the problem, as the proxy benchmark shows.

**Engine** (`tools/local-ai/speech.worker.ts`, `src/lib/subtitles/transcript.ts`, `hinglish.ts`):
- Real language identification over the 99 Whisper language tokens.
- An explicit `<|hi|>` for Hindi and Hinglish, and `transcribe` always.
- Word timestamps from `whisper-{tiny,base}_timestamped`.
- A loop guard.
- Captions grouped from real word times (punctuation, pauses, 7 words or 3.5 s by default).
- Deterministic Hinglish script conversion.

**Benchmark** (`tests/e2e/caption-bench.e2e.mjs`, `caption-bench-score.mjs`, results in `output/caption-bench/report.md`):
- 6 clips × both models × each language setting, 30 runs in real Chrome.
- The clips are synthetic local voices: en-IN Heera and Ravi, en-US Zira.
- English: WER 2.6% and CER 1.9% for both models; language ID 6 of 6 across both models.
- Roman Hinglish (Indian-English voices reading romanised Hindi): Tiny 72% WER, Base 90–97%. Base often translates
  this accented speech into English.
- Real-time factor (recognition time ÷ audio length): about 0.9 for Tiny English and about 2 for Base, in
  single-threaded WASM.
- **Not measured:** real Hindi speech, accents across many speakers, noise, and peak memory. A real Hindi benchmark
  needs recorded Hindi with references (for example FLEURS hi_in, CC BY 4.0), which needs a download the owner has not
  yet approved.

**Captions.**
- Simple and dynamic modes. Dynamic highlighting (current word, current line, progressive reveal, karaoke) uses only
  real word times; without them it falls back to whole captions with a notice.
- Entrances: fade, pop, rise, typewriter.
- 15 presets with thumbnails drawn by the renderer itself.
- Full typography and colour controls, and saved styles.
- Custom fonts:
  - validated by signature, size and the browser's parser;
  - coverage measured per script (a bug where a Latin font's space glyph faked Devanagari coverage was found and fixed);
  - stored in IndexedDB and passed to the export worker as bytes.

**Frame.**
- Original, 9:16 (1080×1920), 4:3 (1440×1080), 16:9 (1920×1080) or 1:1 (1080×1080).
- Fit: contain, cover, or crop with pan and zoom; export scale Full, 75% or Half.
- Per-shape safe areas; caption drag with centre snap.
- A bug found and fixed: the portrait preview was squashed by a height cap.

**Preview equals export.** The preview canvas is the export renderer (`paintFrame` + `drawCaption`), drawn on each
presented video frame (`requestVideoFrameCallback`). The caption box measured in the preview and in the exported frame
matched exactly: (199,966)–(520,1029) in one run and (74,566)–(645,631) in another.

**Tests.**

| Suite | Result |
|---|---|
| `subtitle-studio.e2e.mjs` | 31/31 without the model; 34/34 with real Whisper Tiny (twice) |
| Unit tests | 131 |

The E2E covers consent per model, language and script selection, the editor, 15 presets, font safety, custom-font
rejection and acceptance, dragging, SRT and VTT, 1:1 crop and 16:9 contain exports checked with ffprobe and pixels,
stale results, cancellation and phone layout.

**New dependencies:** none. The new models are two pinned Apache-2.0 Whisper exports, downloaded only after consent.

## 8. Roman Hinglish transcription fix

**Reproduced.**
- The committed worker sent no language for "auto", so Transformers.js 3.8.1 forced `<|en|>`.
- Measured on real Hindi speech, generic Whisper Tiny and Base write romanised, English or Urdu-script text whatever
  token is set: 1 of 80 runs came out mostly Devanagari.

**Root causes.**
1. English was forced in auto mode. Fixed earlier with real language identification.
2. The models are inadequate: Tiny and Base cannot transcribe Hinglish or Hindi usefully in the browser. Swapping
   precision (q4, q8, fp32) and constraining the output script did not help.
3. The audio pipeline: per-chunk resampling zeroed one 16 kHz sample per decoded chunk (about 37 per second). It is
   now a streaming resampler, and a unit test shows it matches whole-file resampling exactly.

Translation was never enabled for captions, and post-processing never replaced words; both were checked.

**Model comparison (medians, real Chrome, the app's own worker).**

| Model | Hinglish clips: WER / CER | FLEURS Hindi (romanised): WER / CER | Real-time factor |
|---|---|---|---|
| Whisper Tiny (q4, ≈95 MiB) | 70% / 33% | 90% / 37% | ≈1.1–1.4 |
| Whisper Base (q4, ≈140 MiB) | 82% / 41% | 97% / 31% | ≈1.8–2.1 |
| **Hindi2Hinglish Swift (q8, ≈100 MiB)** | **27% / 10%** | **40% / 23%** | ≈1.4–1.6 |
| ARTPARK Tiny Hindi, Hindi Small (ONNX) | — | 100% (broken exports) | — |

The Hinglish clips are the brief's four examples plus three more, read by local en-IN voices, so they are synthetic.
FLEURS is real Hindi speech: 20 clips, all female-labelled. Swift kept English terms in the regression clips
("artificial intelligence", "API", "server response", "consistency", "Java"), and all its outputs were Roman.

**Implemented.**
- Roman Hinglish is its own pipeline: Swift by default with separate consent, `<|hi|>` with transcribe, and Roman
  enforced word by word (`enforceRoman`, with a final sweep for ॥ and ॐ).
- There is no Devanagari script option in this mode.
- Devanagari in a Hinglish caption is a validation error, with "Convert to Roman".
- The raw model output is kept in a "Raw transcription" panel.
- Normalization (`normalizeHinglish`) only fixes spacing, sentence capitals and the danda.
- Auto mode warns when detection is uncertain (probability under 60%).
- Hindi stays Devanagari, with a measured warning.

**Tests.**

| Suite | Result |
|---|---|
| Unit tests (Roman enforcement and its final sweep, normalization, resampler) | 140 pass |
| `subtitle-studio.e2e.mjs` with real models | 41/41 |
| localtools | 39/39 |
| notes | 14/14 |
| pdf-audio | 20/20 |

The studio E2E covers the Hinglish UI with no script control, real FLEURS Hindi through Swift giving Roman captions
with zero Devanagari, the raw transcript kept, typed Devanagari flagged, Convert to Roman, and clean-up staying Roman.

**Limitations.**
- Swift has no word timing, so Hinglish captions use phrase timing and dynamic highlighting is off.
- It sometimes adds a spurious word at the start ("while", "2").
- No real code-switched Hinglish recordings from varied speakers were available. The 27% figure comes from synthetic
  voices and the 40% figure from pure Hindi.
- Devanagari Hindi remains below a usable standard in the browser.
- Peak memory and noise robustness were not measured.

### First real, verified Hinglish clip (owner's reel, 2026-11-15)

**The clip.** A 21.75 s creator reel with continuous speech over a loud mix. The owner supplied the verified Roman
Hinglish reference (79 words). The audio is kept locally in `output/caption-bench/user-hinglish/`, which git ignores.

**Scores.**

| Model | WER | CER | Recognition time | Notes |
|---|---|---|---|---|
| Whisper Tiny | 442% | 240% | 15 s | Decoding loop ("This is a problem" repeated) |
| Whisper Base | 86% | 206% | 54 s | "Claude" correct, then a loop ("…gayagaya…") |
| **Hindi2Hinglish Swift** | **38%** | **17%** | 12 s | Roman only, no loop |

**What Swift got wrong** (30 edits over 79 words):
- about 8 for product names it doesn't know (Antigravity, Claude ×2, Gemini ×2);
- about 9 for English technical phrases (prompt, test case ×2, subagents, Installation);
- about 5 for word joins and splits (workflow, iske baad);
- 4 for spelling choices (yeh/yah, banayega/banaega);
- about 4 for other words.

Everyday Hindi in Roman letters was mostly right.

**Loop guard gap.** The guard catches repeated runs of up to 3 words; Tiny's loop was a 4-word phrase. Run with
`BENCH_CLIPS=user-hinglish BENCH_RESULTS=results-user-hinglish.json BENCH_MODELS=tiny,base,hinglish-swift BENCH_LANGS=hi node tests/e2e/caption-bench.e2e.mjs`.

**Possible next step (not implemented).** A user vocabulary list ("Claude, Gemini, Antigravity"), offered as reviewable
suggestions for near-miss spellings and kept separate from the raw transcript. The model itself cannot be biased:
Transformers.js 3.8 has no initial-prompt support.

### Names and terms (vocabulary suggestions)

**Why suggestions.** The speech model cannot be biased in Transformers.js 3.8, which has no initial prompt. So
`src/lib/subtitles/vocabulary.ts` works after recognition.

**How it works.**
- It looks at runs of 1–3 recognised words.
- It compares spelling keys that tolerate Hinglish mishearings (ph/f, w/v, aa/a, ee/i, doubled letters).
- A run is suggested as a fix when it is at least 74% similar to a listed term.
- Everyday Hindi and English function words (hai, ki, aur, the…) never start or end a suggestion.
- Punctuation is kept. Word timings stay real: same word count keeps each word's time; otherwise the term shares the
  replaced span.
- The panel is "Names and terms" in the Captions tab (`VocabularyPanel.tsx`). The list is saved in this browser. Each
  fix is accepted, ignored or undone, and the raw transcription is untouched.

**Measured on the real reel** (Swift output, vocabulary "Antigravity, Claude, Gemini, subagents, workflow, test case,
Installation, prompt"):
- 5 suggestions, all correct: Antigravity, workflow, subagents, test case ×2.
- No false suggestions.
- Accepting them changes WER from **38.0% to 29.1%** and CER from 17.0% to 14.8%.

**Not caught** (honest limit): words the model replaced with something unrelated ("plot" for Claude, "account" for
prompt, "suggestion" for Installation) and fused words ("jaminaegi" for "Gemini ki").

**Tests.**
- `tests/unit/vocabulary.test.ts`: 6 tests on the reel's real output.
- `subtitle-studio.e2e.mjs`: 37/37 without models. The vocabulary checks are suggestion precision, accept all, undo,
  ignore and persistence.
- The real-model studio run (41 checks earlier) was not repeated after this change.
