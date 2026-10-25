# Professional studio implementation — 2026-10-25

Current manual timeline/AI studio and production-build status: [MANUAL_STUDIO.md](MANUAL_STUDIO.md). Results below describe the earlier milestone.

## Audit and implementation plan

The existing product has one workflow hook (`useReelSession`), Mediabunny/WebCodecs, Canvas captions,
worker rendering with OPFS output, server-only transcription credentials, and IndexedDB drafts.
The previous transcription/duration fixes were already uncommitted when this work began; they were
preserved. The framework and media stack were retained, with no new application dependencies.

Gaps found: fixed 9:16 export composition, preset-only caption appearance, no project-level history,
no custom-font worker path, no timestamp-based animation catalog, and no reversible cut timeline.
The plan follows the requested order: editing model → composition → typography/font storage →
placement/presets → effects → silence EDL → staged subject masking → QA.

The existing white/charcoal/yellow identity and responsive three-pane/step layout remain. New
controls are grouped in collapsible sections. The preview uses Canvas for every visual operation
that requires matching export; CSS is used for guides and interface controls only.

## Milestone 1 — foundation

Implemented: a versioned Zod editing model and typed project snapshot, settings undo/redo, per-video
settings persistence, legacy draft migration, and source-specific cuts/title reset. Caption edits
remain in their established editor. A discovered save race was fixed: captions and editing settings
are saved together, and changes immediately mark the save pending. Settings/word changes invalidate
stale exports and cancel in-flight renders. Late render completions cannot overwrite newer settings.

Files: `src/lib/editor/project.ts`, `src/components/editor/useEditingSettings.ts`,
`src/components/editor/useReelSession.ts`, `src/lib/drafts.ts`.

Validation: project schema/history unit tests; existing lab/studio reload, styling, editing,
transcription, and export regressions. `npm run check` passed with the new model integrated.

Manual test: import a video, change a setting, use Undo settings/Redo, refresh, and re-pick the same
video. Settings and captions restore without sending audio again. Source files are intentionally
not copied into IndexedDB; the browser needs you to re-pick the source after refresh.

Next: composition, implemented below. Limitation: history is session-local, with 100 settings states;
caption undo remains separate from settings undo.

## Milestone 2 — composition

Implemented: 9:16, 16:9, 1:1, 4:3, Original dimensions, existing export quality/size presets, Fill/Fit,
normalized horizontal/vertical crop position, scale, letterbox color, and optional blurred source
background. Shared geometry/drawing is used by HTML-video preview and decoded worker samples.
Codec dimensions are even; the source image is never stretched. Changing aspect ratio preserves
captions, style, titles, and cuts. Native preview controls remain for legacy composition; a scrubber
and Play/Pause controls serve custom compositions and edited timelines.

Files: `src/lib/media/composition.ts`, `exportPresets.ts`, `render.ts`,
`src/components/editor/CompositionPanel.tsx`, `parts.tsx`, `useReelSession.ts`,
`src/app/studio/StudioClient.tsx`.

Validation: geometry unit tests and actual H.264 exports/ffprobe/clean decode for all four ratios;
two-color source fixture proves crop position changes the source region and Fit uses its chosen color.

Manual test: Video → Composition. Change ratio, crop sliders, scale and Fit background, then export.
Compare the preview frame with the MP4. Next: typography. Limitations: no custom ratio or free-rotate
tool; blur adds per-frame processing, and no mobile blur throughput claim is made.

## Milestone 3 — typography and fonts

Implemented: a searchable eight-family catalog across Sans Serif, Serif, Display, Monospace and
Handwriting; on-demand family previews; favorites/recent filters; supported bundled weights; local
font import, browser parsing, preview-before-apply, rename, removal and IndexedDB reuse. Extensions,
MIME and 10 MB size are validated before FontFace parsing. Font files stay local. Selected custom
font bytes are provided to the render worker, which loads the same face and Devanagari fallback.
Missing/failed font loads block export instead of silently substituting a different face.

New families: Noto Serif, Roboto Mono, Caveat, Anton. Unmodified OFL licenses, source URLs, sizes and
SHA-256 hashes are in `public/fonts/catalog/SOURCES.md`; existing Devanagari/Latin fonts remain.

Files: `src/lib/editor/fontLibrary.ts`, `src/lib/captions/appearance.ts`, `types.ts`, `draw.ts`,
`src/components/editor/FontBrowser.tsx`, `TypographyPanel.tsx`, `useReelSession.ts`,
`src/lib/media/render.worker.ts`, `public/fonts/catalog/`.

Controls: native/bundled weight, font size, browser italic slant, text color/opacity, letter/line
spacing, alignment, case, max width/lines, outline color/thickness, shadow color/blur/offset,
background color/opacity/padding/corners and spoken-word highlighting. Effects can be disabled
independently. Text is reflowed/shrunk to honor width/line limits and clamped into the frame.

Validation: metadata/license/file-presence unit tests; malformed upload rejected in Chromium;
TTF and WOFF2 imports rendered into real MP4s; preview/export pixel checks with a custom font.

Manual test: Style → Font library. Search/category/favorite a face, upload a font, inspect its sample,
apply it, change typography, and export. Rename/remove uploads using their font cards. Next: placement.
Limitations: custom fonts use their native face; arbitrary variable axes are not discovered. WOFF/OTF
are accepted only if this browser parses them, but the automated fixtures currently cover TTF/WOFF2.
Extra families do not replace the bundled Devanagari fallback. Storage quotas/private mode can prevent
font persistence, and clearing site data removes uploaded files.

## Milestone 4 — placement and presets

Implemented: normalized X/Y controls, five position shortcuts, preview dragging with center snapping,
safe-area/center guides, keyboard-operable sliders, nine professional combinations, and locally saved
custom subtitle presets. Applying a preset updates only caption styling/effects. It preserves video
composition, cut decisions and titles. Custom presets can be removed with confirmation.

Files: `TypographyPanel.tsx`, `parts.tsx`, `StudioClient.tsx`, appearance/project schemas and drawing.

Validation: browser drag/snap assertion, desktop/Pixel 7 overflow checks, and exported caption pixels.
Manual test: Style → Caption placement; turn guides on, drag, then fine-tune with slider arrow keys.
Save a preset under Professional presets, change it, and reapply. Next: animation. Limitations:
safe areas are generic guides; platform chrome varies. Per-caption position overrides are not included.

## Milestone 5 — deterministic effects

Implemented: None, Fade, Slide Up, Scale In, Word Pop, Bounce, Typewriter and Word Reveal; a searchable
effect browser with manually scrubbed Canvas samples; applicable duration/intensity controls.
Karaoke Highlight is an independently configurable timed-word preset. Samples do not auto-play,
including for reduced-motion users. Export effects use video/caption timestamps, never CSS animation
state. Typewriter uses grapheme segmentation so Devanagari combining sequences stay intact.

Files: `src/lib/captions/animation.ts`, `draw.ts`, `src/components/editor/AnimationPanel.tsx`.
Validation: deterministic/finite-frame unit tests, plus per-effect preview/export pixel comparisons.
Manual test: Style → Subtitle animations, scrub the sample slider, select an effect, play/export the
clip. Duration/intensity controls are disabled for effects where they do not apply. Next: silence cuts.
Limitation: effects are intentionally restrained; no motion-blur or tracking effects are claimed.

## Milestone 6 — reviewable silence removal

Implemented: streaming decoded-audio RMS analysis in a separate worker; threshold/minimum-pause/
retained-pause controls; measured progress and cancel; waveform/candidate visualization; source-time
start/end edits, selection and listening; explicit Apply reviewed cuts; Undo/Redo; preserve-all action.
Cuts are non-destructive and are never automatically applied from the detector's suggestions.

The normalized EDL maps source and edited time. Audio samples are clipped at sample boundaries,
retimestamped and re-encoded; video samples are clipped to retained portions using available source
frames. Captions are remapped without regrouping blocks, so SRT and burned-in blocks agree. The
preview skips source cuts and draws captions using edited timestamps; ordinary titles remain tied
to their source events. All-pauses-preserved is reversible, and exports with no usable duration fail.

Files: `src/lib/editor/timeline.ts`, `src/lib/media/silence.worker.ts`, `render.ts`, `exportPresets.ts`,
`src/components/editor/SilencePanel.tsx`, `parts.tsx`, `useReelSession.ts`, `StudioClient.tsx`.

Validation: merge/clamp/mapping/sample-intersection/caption-block and RMS unit tests; actual analysis
of two tone phrases with pauses; exported duration, decoded phrase onset measurement, ffmpeg decode,
caption/SRT remapping, and Undo restoring the original six-second duration.

Manual test: Captions → Silence removal → Analyze pauses locally. Listen and adjust candidates,
uncheck anything to preserve, apply, preview/export, then undo. Next: staged segmentation evaluation.
Limitations: quiet speech/music/noise need human review. Video edits use existing frames, not optical
flow interpolation. Preview seeks are browser-dependent; abrupt manual cuts can click. Audio is
re-encoded (AAC where available, Opus fallback otherwise), with possible codec priming/padding.
No claim of professional sample-perfect end-to-end precision on real devices is made.

## Milestone 7 — overlays implemented; subject segmentation staged

Implemented: source-timed ordinary title overlays with editable text, normalized placement, size,
color and opacity, using the selected font/effect in shared preview/export drawing. Overlay-only
projects can export without transcription. Titles persist and participate in project undo/redo.
The UI explicitly says subject masking is unavailable; no static mask or CSS trick stands in for it.

Files: `src/components/editor/OverlayPanel.tsx`, `src/lib/captions/overlays.ts`, project model,
`parts.tsx`, `render.ts`, `StudioClient.tsx`.
Validation: cyan title pixels in a real exported MP4, source-time persistence and cut-timeline tests.
Manual test: Style → Text overlays → Add title. Adjust source times, position and color; export.
Next: benchmark and implement a real local person-mask pipeline, separately from this core editor.

Research: MediaPipe Image Segmenter supports video/person masks and worker execution. Its model card
describes 249/244 KB models and Apache-2.0 licensing, while published native Pixel 6 latency is about
33–34 ms; those are not browser measurements. `@mediapipe/tasks-vision` registry metadata currently
reports version 1.1.1 and 42,064,546 unpacked bytes, before a chosen model. No package/model was added.
See `docs/research/README.md` for primary sources and the planned evaluation gates.

Segmentation remains **not implemented**: matching masks after seeking/cuts, temporal smoothing,
memory under encoding load, artifact-specific licensing, cancellation and real-phone compatibility
must be measured before enabling it. No cost or remote video processing was introduced.

## Milestone 8 — QA and remaining release gates

Automated evidence is recorded in the final verification section below. The advanced suite generates
real colored/video/audio fixtures, intercepts transcription success responses, exports MP4s, checks
pixels/dimensions and decodes output audio. This is not a live transcription quality test.

Remaining gates: real Android runs; broader browser/device/codec matrix; long-session memory and
blur/ML performance; production-host acceptance; successful live transcription quality/sync; genuine
subject segmentation if it is to be enabled. The pre-existing default Windows Turbopack CSS-worker
crash remains. The verified production fallback is:

```text
node node_modules/next/dist/bin/next build --webpack
npm run e2e
```

The next recommended milestone is the real-device/export compatibility pass, followed by a measured,
opt-in segmentation prototype. The core editor does not wait on that model work.

## Verification results

- `npm run check`: passed Next type generation, strict TypeScript, ESLint, and **254 unit tests**.
  Six Postgres tests skipped without `TEST_DATABASE_URL`.
- `npm run build`: retried; still fails in the existing Windows Turbopack CSS worker before connection.
- `node node_modules/next/dist/bin/next build --webpack`: passed production compilation, page generation
  and tracing. This is the build used for browser verification, with the existing Tailwind loader.
- `npm run e2e`: passed **172/172** across lab 67, studio 39, server 20, phone simulations eight,
  advanced 38. The server database-row assertion is skipped without `E2E_DATABASE_URL`.
- Expanded `advanced.e2e.mjs` with preset persistence and active-font removal checks: **40/40 in
  Playwright Chromium and 40/40 in Microsoft Edge** (`E2E_CHANNEL=msedge`). These use isolated test
  browsers, not the user's profile. The latest expansion adds two checks beyond the full-run count.
- Per-effect mean preview/export RGB differences on the colored test fixture were approximately
  3.7–3.9 levels, including custom-font rendering. Codecs introduce small pixel differences.
- Six-second pause fixture: edited video 3.22 s, encoded audio 3.242667 s. Decoded phrase starts
  0.50 / 1.89 s versus mapped 0.50 / 1.88 s (maximum 10 ms error on this fixture).
- Desktop 1440×900 and emulated Pixel 7 screenshots inspected. Mobile controls have no horizontal overflow.
- `git diff --check`: passed, with Git's existing CRLF-normalization notices only.

Evidence images/MP4s/SRT are in ignored `tests/e2e/.out-advanced/`, with existing regression artifacts
in `.out/`, `.out-studio/` and `.out-phone/`. These are generated test media, not real user clips.
No real-phone, Firefox/Safari, long-session memory, production-host or successful live-transcription
quality verification is claimed. The task's pre-existing uncommitted work and `.env.local` were preserved.
