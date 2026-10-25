# Manual and AI studio — 2026-10-25

The studio now has eight tools, a selectable canvas preview, contextual properties, and a source-time timeline. This builds on the existing local composition, font, transcription and worker export pipeline.

## Use the studio

1. Open `/studio`, choose a video, and choose the frame ratio in Video. Silent footage is accepted here for manual editing; the speech-focused lab retains its audio requirement.
2. Open Captions → Add manual caption. New captions occupy the next available interval at or after the playhead. Select a caption in the list, preview or timeline. Edit text and start/end, press Enter or leave the field to commit. Manually rewritten words receive evenly estimated word times; the properties panel says so.
3. Drag the visible caption or title bounds in the preview. Positions are normalized to the output frame and snap near 10%, 50% and 90%. Arrow keys move a focused item. Lock items to prevent editing; lock all caption positions from Subtitle styles to prevent preview movement. Reset overrides restores the global caption style.
4. Use Subtitle styles for shared styling, bundled/uploaded fonts and saved presets. Selected-caption properties set independent font, weight, size, color, highlighting, opacity and animation. Explicit overrides survive global changes. Text & overlays offers independent foreground titles; subject segmentation remains unavailable and is labelled.
5. The timeline uses original source seconds, including gaps for removed ranges. Playback also shows output seconds. Seek with the source slider. Drag captions/text to move them; drag their edges to change timing. Captions cannot overlap. Exact timing fields provide a keyboard alternative. Video edges shorten a segment; Clip properties provide exact trim fields. Split at the playhead and delete selected segments. Undo restores removed material.
6. Select the Audio track for volume/mute and local waveform analysis. Silence removal produces adjustable, selectable proposals. Preview proposed cuts first; this does not change export. Apply reviewed cuts merges them with existing manual cuts. Restore all removed ranges clears the applied EDL. This is amplitude analysis, not semantic speech detection.
7. Export produces MP4 and caption SRT locally. Preview/export share caption overrides, font loading, positioning, animation, composition and the same cut map. Volume edits multiply actual decoded PCM; mute removes the audio track. Source frames define cut precision; no frame interpolation or audio crossfade is claimed.

The timeline is collapsible, zoomable and scrollable; desktop height is adjustable. It starts collapsed on phones to reserve space for properties. Space toggles playback outside form controls; Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z operate the shared history outside editable controls. History contains up to 100 settings snapshots, never video bytes. One preview drag is one undo step. Settings and captions save locally per source fingerprint; reselect the same source after reload. Uploaded fonts remain in browser storage.

## AI editing

`/api/edit-plan` uses server-only `GROQ_API_KEY`, with optional `GROQ_EDIT_MODEL` (default `openai/gpt-oss-120b`). Public Vercel deployments also require the existing Postgres limiter and Turnstile configuration. Missing/placeholder keys are explained; manual editing remains available.

The UI discloses what is sent: the editing instruction, selected ID, duration, available font IDs, caption IDs and times. It does not send video, audio, transcript text or font files. Text typed into the instruction is sent. Groq returns a JSON plan constrained to the operation schema. The user can inspect/edit/discard it before applying. The server rejects malformed/unsupported output, caps streamed request bytes, times out provider calls, rate limits and enforces configured human checks. The client rejects invalid references/times, overlaps and plans generated before subsequent project changes. Application is atomic and uses exactly the same reducer as manual edits. No generated code is executed.

Supported plans: global/caption appearance, caption text/timing/add/delete/split/merge, ratio, trim/cut/video split, audio volume/mute, caption animation and a request for local silence analysis. Silence analysis still produces proposals requiring review. There is no arbitrary asset generation, clip reordering, multi-source montage, transition engine or automatic music selection.

## Verification

- `npm run check`: strict TypeScript, ESLint and 274 unit tests passed; six Postgres tests skipped without `TEST_DATABASE_URL`.
- `npm run build`: passed. The standard script now selects webpack because the default Windows Turbopack CSS worker repeatedly exited before connecting. The existing installed Tailwind compiler integration is reused; no dependency was added.
- `tests/e2e/manual.e2e.mjs`: 42/42 Chromium checks passed. It exercises caption movement and timing edges, splitting/merging, actual preview drag, one-step drag undo, locking, overrides, separate title fonts, trims/deletion, persistence, missing AI config, mocked-plan review/rejection/staleness/apply/undo, silent-footage caption/export, playback-following playhead, and emulated Pixel 7 access/zoom/collapse.
- Measured exported audio gain: 0.49925 for a 0.5 setting. Mute produced no audio stream; combined clip edits produced the expected 2.4-second output. Caption/title preview and decoded export pixels matched within codec tolerance, with separate green/cyan text checks. Manual text was present in SRT.
- `npm run e2e`: passed all six suites, **218/218** checks: lab 67, studio 39, server 20, phone decoder/encoder simulations 8, advanced composition/font/silence 42, manual studio 42. Shared limiter database-row checks were skipped without `E2E_DATABASE_URL`. Final manual-suite rerun also verifies the last AI font-context change.

Evidence is generated under ignored `tests/e2e/.out-manual/` and `.out-advanced/`; these contain synthetic clips and screenshots. Real-phone touch behavior, Safari/Firefox, production hosting, successful live AI/transcription output and long-session memory remain unverified. AI browser tests use mocked plans and unit tests mock provider responses; none claims a successful live-provider call. Project metadata can be lost if browser storage is cleared. Cut audio is re-encoded and abrupt boundaries may click.

Claude's remote commit `de67e3d` was fetched but not merged over the overlapping uncommitted studio work. Its fetched reference remains available. Existing local changes and `.env.local` were preserved.
