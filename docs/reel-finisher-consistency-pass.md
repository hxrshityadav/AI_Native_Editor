# Reel Finisher: consistency pass against LLM Dojo (8 November 2026)

Scope: a precision pass, not a redesign. No new visual elements and no engine changes. Uncommitted.

## Problems identified (reference screenshot vs Reel Finisher at 1440px, measured)

| # | Difference | Effect | Fixed in |
|---|---|---|---|
| 1 | The reference keeps two independent 8/4 columns. Reel Finisher broke into full-width and half-width rows after the hero, leaving ragged bottoms. | Sections read as separate designs | `page.tsx`, `home.css`: strict columns, last panels stretch so both columns end on one line |
| 2 | Panel gaps were 20px; the reference uses about 24px. | Rhythm tighter than the padding | `--gap-panel` = 24px everywhere |
| 3 | Panel padding was 28px; the reference uses about 24px. | Padding and gaps in different rhythms | `--pad-panel` = 24px (20px on phones) |
| 4 | The nested bench panel had an 18px radius found nowhere else. | Odd radius | `--radius-lg` = 20px for all secondary panels |
| 5 | The frame sat 12px from the window edge (the reference about 24px). | Cramped canvas | Frame margin `--space-6` |
| 6 | The rail top was 10px above the first panel; the search pill was not on the panels' left edge. | Near-miss edges | Rail top = panel top (y 120); search x = panel x (144) |
| 7 | The hero lead was 17px near-white (the reference is 16px muted, looser). | The lead competed with the heading | 16px / 1.65, muted |
| 8 | Panel header actions were text links (the reference uses pills such as "View module"). | Two treatments for one job | Secondary pills; full-width pill at the panel foot |
| 9 | Four different search fields (44, 48, 48 and 52px, mixed borders and radii) | The same interaction looked different | One search pill, 44px, 1px edge border |
| 10 | Button heights of 40, 44, 46 and 48px, with 16 or 20px padding | Visible geometry drift between pages | Every button 40px with 20px padding |
| 11 | Card radii of 10, 14, 18, 20 and 24px | No radius language | 10 / 16 / 20 / 24 (+ pill, frame) |
| 12 | Tool-page tabs used an underline; the rest of the site uses pills. | Mixed tab language | Pill tabs, tonal current tab (done in the rail pass) |
| 13 | Icon stroke 1.9 | Heavier than the brief | 1.75, round caps and joins |
| 14 | Mono format list sat about 3px above the privacy line on tool pages. | Misaligned metadata row | 20px line box |

## Tokens consolidated (`src/components/site/public-site.css`, `.site`)

- **Radius:** `--radius-control` became `--radius-sm` (10px) and `--radius-inset` became `--radius-lg` (20px), renamed in every CSS and TSX use. Added `--radius-md` (16px). `--radius-frame` is now 36px and `--radius-pill` 9999px.
- **Added:** `--space-1…8`, `--gap-panel`, `--pad-panel` (responsive), `--control-height` (40px) and `--search-height` (44px).
- **No duplicate tokens remain.** Rules are documented in `DESIGN.md` under "Geometry and consistency rules (pass 3)".

## Components standardized

- **`buttonClass`** (`ui.tsx`): the md and lg sizes now share one geometry: 40px pill with 20px padding.
- **Tool surface** (`ToolSurface.module.css`):
  - Browse, Process, Download and Secondary are 40px, 20px padding, 14px text.
  - Fields are 40px.
  - Thumbnails use `--radius-sm`.
  - Steps, related links, the feature band and the root use spacing tokens.
- **Bench** (`public-site.css`): actions are 40px pills; the format select is 40px with the subtle edge.
- **Search:** the top bar, `.directory-search`, `.cmd-preview-input` and `.cc-search` share the 44px pill with one border rule.
- **Command Center:**
  - The Clear actions became destructive pills.
  - Cards, tiles and settings rows use 16px radii.
  - Section gaps are 32px; the layout gap is 24px.
  - The rail and index are sticky at the same offset.
- **Directory:** tool-card padding 16/20, a 12px card gap, sections 32px apart, and a 24px layout gap.
- **Tool page layout:** header spacings and support panels follow the token gaps.

## Pages refined

Every public page inherits the shell geometry. The homepage was recomposed. The directory, all 28 tool pages (through `ToolPageLayout` and `ToolSurface`), the Command Center, Privacy and Supported Formats inherit the token changes.

## Files changed in this pass

- `src/app/page.tsx`
- `src/components/site/home/home.css` (rewritten on tokens)
- `src/components/site/public-site.css`
- `src/components/site/ui.tsx`
- `src/components/site/ToolFinder.tsx`
- `src/components/site/Sidebar.tsx`, `src/components/site/SiteShell.tsx` (token renames)
- `src/components/tools/surface/ToolSurface.module.css`
- `src/components/command-center/command-center.css`
- `src/components/media/PdfAudio.tsx` (token rename)
- `DESIGN.md`

## Functionality preserved

No engine, worker, upload, cancellation, download, model-loading or privacy code changed. All edits are CSS, class names, and the homepage's section order inside new column wrappers.

## Screenshots captured (`output/design-reference/`)

| File | What it shows |
|---|---|
| `rf-home-before.png` | Homepage before the pass |
| `rf-home-after.png`, `rf-home-after-full-half.png` | Homepage after |
| `final-{home,tools,image-compressor,video-compressor,audio-cutter,command-center}-1440.png` | The six screens at desktop |
| `final-*-390.png` | The same screens at phone width (full page) |

## Measurements (dev server, Chromium)

Six pages at 1440, 1280, 1024, 768, 390 and 360px:
- **Overflow:** 0 everywhere.
- **Panel radii present:** only 24px, 20px and 16px.
- **Panel padding:** 24px at 768px and up, 20px below.
- **Button heights:** 40px only.
- **Edges:** the rail top equals the first panel top (120px), and the search pill and panels share x 144px.

## Tests executed

- `npm run check` (`next typegen`, `tsc`, ESLint, Vitest): **passed**, 84 tests.
- Taste inspector (app mode) on the homepage, directory, Command Center and Audio Cutter: **0 FAIL**.
- Taste source linter: 9 FAIL, all for mono metadata, which the brief requires; kept and documented.
- **Not run in this pass:**
  - **Production build and E2E suites.** A `next dev` server you started is running on port 3000, and the build clears the `.next` folder it uses. The site suite's sidebar checks were already rewritten for the rail.

## Remaining inconsistencies

- The Command Center's and directory's section headings sit on the frame rather than inside panels. This matches the reference's interview page, but differs from the homepage, where every section is a panel.
- The Stageshow category pictures keep their pre-rendered orange highlights.
- Individual tool controls (waveform players, range rows) use the shared tokens, but were not re-laid out one by one.
