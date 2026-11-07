# Reel Finisher workflow illustrations

Static, labelled product illustrations adapted from Benji Taylor's Stageshow 1.1.1.
The composition starts from `examples/static-card`; `gold/` preserves that reference,
with direct imports replacing the upstream barrel. `kit/` contains only the 20 files
reachable from Stage, Window, Row and Avatar. `scripts/` contains the upstream film
checks. MIT license and upstream notices are retained alongside this file.

The public website loads only eight WebP stills under `/illustrations/`. It does not
import this workshop, its React kit, browser scripts, or any third-party brand art.
The app's real processing controls remain authoritative. Illustration dimensions,
waveforms and caption text are examples, not measured processing results.

## Regenerate

From the repository root, with the existing OpenReel workspace installed:

```powershell
node vendor/openreel/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.41/node_modules/vite/bin/vite.js --config vendor/stageshow/vite.config.mjs --port 3197
```

In another terminal:

```powershell
node vendor/stageshow/render.mjs http://127.0.0.1:3197
node vendor/stageshow/scripts/film.mjs 'http://127.0.0.1:3197/?scene=photo' --still --gate --select '.ss-fit' --width 520 --out output/stageshow-gate-photo-520.png
```

Repeat film for `photo`, `video`, `audio`, `ai` at widths 520 and 390. The render
script uses a separate 358px composition for mobile; filming at 390 selects it
through Stage's compact breakpoint. Existing Playwright, installed Chrome and the
developer's ffmpeg executable are used for authoring only. No npm install or paid
service is required. Vite production builds have `copyPublicDir: false` to avoid
copying the application's large model cache into workshop output.

See `REHEARSAL.md` for actual checks and limitations.
