# Local browser editor

`/studio` hosts the pinned OpenReel fork at `/editor/index.html`. `/studio-legacy` keeps the previous manual editor and its original local database available. New projects use OpenReel's renderer, media library, timeline and native history.

## Development

Use Node 24 and Corepack. Run `npm install` at the repository root, then `npm run build` and `npm start`. The build installs the fork's filtered workspace dependencies when needed, using pnpm 11.7.0 and its lockfile. Root package management remains npm. `npm run dev` builds the editor before starting Next.js; after changing fork source, run `npm run editor:build` to refresh its static output.

`npm run check` includes root checks and focused fork type/unit checks. `npm run e2e` includes legacy and browser-editor suites. `npm run e2e:editor` runs only the new editor suites. Test videos are generated locally with system ffmpeg/ffprobe; those tools are test infrastructure and are not bundled into the browser.

## Local processing and offline use

The default server configuration rejects Groq/Sarvam transcription and AI edit-plan POSTs before reading the body. `REEL_ENABLE_CLOUD=1` explicitly opts a legacy deployment into its previous provider routes; it does not enable cloud calls in the new editor.

The first online visit installs the editor assets in its own cache. Keep browser storage available. Original media and projects are stored locally; retain original media and downloadable project copies because browsers can evict storage.

Open **Captions & tools → Local Whisper**, choose the fast model, and use its download button. Download progress describes the current model file's received bytes. The larger model is optional. Downloads fetch model assets only. The allowlisted `/editor-models/` route streams public model files from the upstream asset host, whose direct responses lack browser CORS headers; the route accepts no media or transcript uploads. Close/reset the model panel to cancel a download or recognition worker. Manual Hindi/Hinglish captions need no model. Automatic recognition returns segment timing, so review words manually and do not assume karaoke-grade alignment.

To run an actual local-speech/model acceptance test, set `OPENREEL_SPEECH_FIXTURE` to a local WAV containing speech before `npm run e2e:editor`. Without it, routine acceptance tests cover model-independent editing and offline export without downloading a model.

## Existing projects

Choose **Import legacy** on the studio home, or **Captions & tools → Legacy import**. Select the saved draft and reselect the original video. A media fingerprint must match. Review the converted intervals, captions and compatibility issues, then create the separate project. The legacy draft is never overwritten. Reopen the legacy editor to recover unsupported projects.

## Current compatibility limits

Use browser-supported MP4/WebM codecs. FFmpeg fallback is excluded. Synchronized range removal refuses unsupported advanced timing structures rather than silently desynchronizing them; see the fork's patch inventory for the exact restrictions. Individual native editing tools remain available where the browser supports them. Physical-device performance and every browser/codec combination require separate validation.

Upstream provenance and patch inventory: `vendor/openreel/UPSTREAM.json` and `vendor/openreel/REEL_FINISHER_PATCHES.md`. MIT licensing covers the upstream application code; bundled dependency/font licenses still apply.
