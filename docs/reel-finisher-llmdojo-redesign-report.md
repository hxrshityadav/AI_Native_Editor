# Reel Finisher redesign from the LLM Dojo study: implementation report

Date: 8 November 2026. Branch `redesign/site-and-tool-workspace`, on top of `e7bbc26 Redesigned UI`. Uncommitted.
Status: **Tested** (automated, production build, Windows with installed Chrome). Not verified on a physical device.

Reference analysis: `docs/design-reference-llmdojo.md`. System: `DESIGN.md` (the sections marked *rev. 8 Nov*).

## What changed and why

The study found that LLM Dojo works because every block is a working entry point with true numbers, content sits in borderless panels on tone steps, one search sits at the top of every page, and motion is short and calm. Reel Finisher keeps its own black, blue and orange identity. It took the structure, not the look.

| Area | Change |
|---|---|
| Type | Public pages moved from the system stack and Mukta display face to **Geist and Geist Mono** (vendored, OFL 1.1, about 58 KB each), with weight-600 headings and −0.03em tracking. Mono is used only for formats, sizes, counts, limits and keys, via the `.meta` class and `kbd`. Geist is credited in `/media-notices/SOURCES.txt`. |
| Shape | 20px panels, 14px insets, 10px fields, and **pill** buttons for every action (orange primary, blue-edged secondary, text tertiary). |
| Shared classes | `.panel`, `.panel-inset`, `.meta`, `kbd`, `.row-link` (list row with a hairline, ellipsis and chevron), `.status-line`, and a disclosure height animation where `interpolate-size` exists. |
| Navigation | **Desktop:** a new sticky top bar with a search pill (Ctrl K) and pills for Command Center and Reel Studio. The sidebar keeps every tool and drops its duplicate launcher. **Phones:** a slim header (wordmark and Menu drawer) plus a new fixed **bottom tab bar** (Home, Tools, Command, Search). |
| Palette | The same single dialog, now with "Try" suggestion chips (compress, mp4, gif, heic, wav, captions) and the reference's 180ms entrance. A dead `CommandPaletteLauncher` was removed. |
| Footer | A panel with real navigation columns generated from the catalog (AI, Video, Audio, Photo, Reel Finisher). |
| Homepage | Rebuilt as a bento of working panels (see below). |
| Tool directory | A sticky category index with counts beside the content, a pill search, filter pills with mono counts, and borderless tool cards: Lucide glyph, name, an AI badge in mono, summary, and a format or transform line in mono. |
| Tool pages | The header gains the tool's icon tile and a mono format line from the catalog, beside the privacy badge. How-to, features, information, FAQ and related tools now sit in panels; steps and related links are tonal tiles. The upload dropzone sits on a panel tone. All processing components are untouched. |
| Command Center | Takes the new type, panels and mono metadata. Its duplicate search launcher was removed in favour of the global bar and tabs. Every feature still works (suite below). |
| Motion | **GSAP removed** (dependency uninstalled). It is replaced by CSS: homepage panels settle once (420ms, staggered), the palette opens over 180ms, disclosures animate height over 240ms, hover tone changes take 140ms, and buttons press-scale. All of it is off under reduced motion. |

### Homepage panels (all real)

1. **Hero:** headline, lead with the real tool count, the four promises, Explore tools, Command Center and Reel Studio, and the **real compression bench** in an inset.
2. **Find a tool:** a live catalog search with category filters.
3. **Local AI models:** four rows with true download sizes from `docs/local-models.md`.
4. **Tool categories:** the existing Stageshow illustrations with real counts.
5. **Popular workflows:** four chains of real tools, stated as suggestions, not a pipeline.
6. **Start with these:** six tools with format metadata.
7. **Why local processing matters:** three plain claims and a privacy link.
8. **Supported formats:** a curated in-to-out list consistent with the catalog and `/supported-formats`.
9. **Questions:** five answers.

## Files

- **Created:** `src/components/site/AppBars.tsx`, `public/fonts/geist/{Geist-Variable.woff2, GeistMono-Variable.woff2, OFL.txt}`, `docs/design-reference-llmdojo.md`, this report.
- **Modified:**
  - `src/app/globals.css`, `src/app/page.tsx`, `src/app/tools/page.tsx`
  - `src/components/site/{SiteShell, Sidebar, ToolDirectory, ToolFinder}.tsx`, `src/components/site/{public-site.css, home/home.css, home/CommandPreview.tsx}`
  - `src/components/tools/{ToolPageLayout.tsx, surface/ToolSurface.module.css}`
  - `src/components/command-center/{CommandCenter.tsx, CommandPalette.tsx, command-center.css}`
  - `scripts/prepare-media-notices.mjs`, `DESIGN.md`, `.gitignore` (reference captures)
- **Deleted:** `src/components/site/home/HomeMotion.tsx`.
- **Tests updated for intended structure changes:** `tests/e2e/site.e2e.mjs` (tool-link counts now target `.category-tools`, because the directory index adds navigation links) and `tests/e2e/redesign.e2e.mjs` (category artwork moved to `.category-grid`).

## Dependencies

**Removed:** `gsap`. **Added:** none. The Geist font files are vendored assets, not a package.

## Preserved

- every tool engine, worker, limit, consent gate, cancellation path and download;
- privacy copy and the catalog as the source of truth;
- the approved Shorts Maker handoff;
- route-only favorites and recents, and blocked-storage recovery;
- noindex on internal routes.

`/studio`, `/studio-legacy`, `/lab`, `src/components/editor`, `vendor/openreel` and `public/editor` have **no changes**: the diff against HEAD for those paths is empty, and none of them mounts `.site`.

## Tests executed (production build)

| Run | Result |
|---|---|
| `npm run check` (types, ESLint, Vitest, editor checks) | Passed: 366 site unit tests (6 skipped), 15 editor test files |
| `npm run build` (clean) | Passed |
| `site.e2e.mjs` | **160/160** |
| `redesign.e2e.mjs` (every public route at 1440, 1280, 1024, 768, 390 and 360: one h1, no overflow, no model or editor downloads) | **91/91** |
| Command Center / photos / passport / HEIC / background / video compressor / media / Studio | **15/15, 44/44, 13/13, 11/11, 13/13, 37/37, 43/43, 39/39** |

**Screenshots:**
- every public route at 1440 and 390: `output/redesign/*-1440.png`, `*-390.png`;
- light and dark checks: `output/site/`;
- the Command Center: `output/command-center/`;
- Taste inspector captures: `.taste-skill/dojo-*`.

## Design audit results

| Page | Taste inspector |
|---|---|
| Homepage (page mode) | 3 FAIL: **mono**, **hairline**, **icon-cards**@390. Kept deliberately, because the brief asks for mono metadata and the reference uses row hairlines and consistent tool icons. These are recorded rather than suppressed. |
| `/tools`, Image Compressor, Command Center (app mode) | 0 FAIL |

Remaining warnings: no video (the bench is the live element), off-centre margins (asymmetric sidebar shell), below-the-fold density on long directories, ragged rows in the Command Center when favorites is empty.

## Remaining issues

- The reference captures came from Firecrawl in the light theme. The dark tokens were read from live CSS. A focus-ring width on LLM Dojo could not be read and is marked Unknown.
- Individual tool workspaces inherit the new tokens and panels; their internal layouts (waveforms, range controls) were not redesigned one by one.
- No physical-device testing, and no production-host testing (the release is still NO-GO per `docs/production-readiness-report.md`).
- Nothing is committed.

---

# Pass 2 (8 November 2026): LLM Dojo design language replaces the brand palette

Status: **Tested** (automated, production build). The old black, electric-blue and orange identity is removed from the public experience. Not verified on a physical device. Uncommitted.

## Visual changes
- **Palette:** LLM Dojo's verified dark tokens are the default, with its light tokens behind a new theme toggle (`data-site-theme`, remembered per browser, applied before paint). The existing token names were remapped, so every component inherited the change. No old blue or orange hex values remain in public CSS or TSX.
- **Roles:**
  - Primary actions are foreground-on-background pills, including the tool surface's Browse, Process and Download.
  - Secondary actions are surface-2 pills; tertiary actions are text.
  - Selection is tonal, with no outlines. Icons are neutral.
  - Amber appears only on focus, links, control accents, real progress, the pinned star and small status dots.
- **Shell:**
  - Desktop has a 32px rounded application canvas on `#1c1c1f`, with borderless panels on `#131315` and insets on `#1c1c1f`.
  - The top bar holds the search pill (Ctrl K), Command Center, Reel Studio and the theme toggle.
  - On phones the page is the canvas, with a header (wordmark, theme, Menu) and the bottom tabs.
- **Type:** 32/40 page titles, 20/27.5 panel titles, 16/24 body, 14px buttons, 12px Geist Mono metadata.
- **Icons:** Lucide at stroke 1.9 on the 24px grid (reference 1.6 on 20px), with round caps and joins.
- **Tool workspace:** the outer border, file-bar divider, side-column divider, segments, chips, messages, result table and icon buttons are now tonal. Borders remain on fields only.
- **Real data pictures:**
  - The homepage "Local AI models" panel is a size chart in the reference chart palette, built from exact byte counts in `docs/local-models.md` and labelled with its source and scale.
  - Directory cards show "Runs locally" and any model download with its size, from a new optional `model` field in the catalog.

## Files changed in pass 2
- **Tokens and shell:** `src/components/site/public-site.css`, `src/app/globals.css`, `src/components/site/SiteShell.tsx`, `src/components/site/AppBars.tsx` (theme toggle), `src/components/site/Sidebar.tsx`.
- **Root layout:** `src/app/layout.tsx` gained `suppressHydrationWarning` on `<html>` for the pre-paint theme attribute.
- **Pages and components:** `src/app/page.tsx`, `src/components/site/home/home.css`, `src/components/site/ToolDirectory.tsx`, `src/components/site/ToolFinder.tsx`, `src/components/site/ui.tsx`, `src/components/tools/surface/ToolSurface.module.css`, `src/components/command-center/command-center.css`, `src/components/media/{AudioToVideo, GifMaker, MediaTool, PdfAudio}.tsx` (class names only).
- **Data:** `src/lib/tools/catalog.ts` (the optional `model` field on nine tools), `src/lib/site.ts` (theme-color `#0a0a0b`).
- **Tests:** `tests/e2e/site.e2e.mjs` (theme-color expectation).
- **Docs:** `DESIGN.md`, `docs/design-reference-llmdojo.md` (section 10, implementation findings).

## Preserved
- All tool engines, workers, limits, consent, cancellation, validation, downloads and privacy copy.
- The Command Center: palette, favorites, recents, settings and blocked-storage recovery.
- The Shorts Maker handoff.
- `/studio`, `/studio-legacy`, `/lab`, `src/components/editor`, `vendor/openreel` and `public/editor`: the diff is empty.

## Screenshots (Taste inspector, 1440 / 768 / 390)
| Screen | Folder | Inspector result |
|---|---|---|
| Homepage | `.taste-skill/dojo2-home/` | 0 FAIL in app mode |
| Directory | `.taste-skill/dojo2-hometools/` | 0 FAIL |
| Image Compressor | `.taste-skill/dojo2-hometools-image-compressor/` | 0 FAIL |
| Video Compressor | `.taste-skill/dojo2-hometools-video-compressor/` | 0 FAIL |
| Audio Cutter | `.taste-skill/dojo2-hometools-audio-cutter/` | 0 FAIL |
| Command Center | `.taste-skill/dojo2-homecommand-center/` | 0 FAIL |

Light theme: `output/design-reference/light-home-1440.png` and `light-compressor-1440.png`. The suites also produce every route at 1440 and 390 in `output/redesign/`.

## Tests (production build)
| Run | Result |
|---|---|
| `npm run check` | passed (366 unit tests, 6 skipped; editor suites) |
| `npm run build` | passed |
| site / redesign (all public routes × 6 widths) / Command Center | **160/160**, **91/91**, **15/15** |
| Light theme | renders on `/` and `/tools/image-compressor`; the toggle switches back and saves; no console errors |
| Photos / passport / HEIC / background / video compressor / media / Studio | **44/44, 13/13, 11/11, 13/13, 37/37, 43/43, 39/39** |

## Outstanding
- In page mode, the inspector still flags 12px mono metadata, row dividers and the tool-icon list. All three are what the brief specifies, so they were kept.
- The Stageshow category illustrations are pre-rendered with warm-amber selections. They sit well with the amber accent but were not re-rendered.
- Individual tool controls inherit the system; their internal layouts were not recomposed tool by tool.
- No physical-device or production-host testing. Nothing is committed.
