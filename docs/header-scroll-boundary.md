# Header overlap root cause — 14 November 2026

## Reproduction

The existing dev server at localhost:3000 was inspected at 1900×1000 before
any changes. Full rectangles and computed positioning for the frame, shell,
header/background, content wrapper, main, homepage columns, sidebar and footer
are in `output/header-root-cause/before.json`. The header background is painted
by `.top-bar` itself; there is no separate background element or duplicate
visible desktop header. `before-0.png`, `before-80.png`, `before-400.png`
capture matching window-scroll states.

Initial layout really had a 20px gap. The previous report was incomplete:
checking that gap at page arrival did not verify the overlap during scrolling.
At window.scrollY=80 the sticky header was y=0–68 while the main/hero started
at y=32. This is a -36px raw header-to-main difference. The supplied symptom
is reproduced in before-80.png: the hero heading and supporting column run
under the search/header boundary.

## Proven cause

DOM: `.app-frame` → `.shell-content` (flex column) → sticky `.top-bar` and
normal-flow `#content` → `main` → `.home-columns`.

The sticky header still reserved its original flow height. It was not fixed
or absolute, and no transform or negative margin caused the problem. The
actual conflict was two scrolling/positioning behaviors: a header pinned to
the viewport over an unbounded document-scrolling main. The 20px margin moved
the initial main but scrolled away with it. Increasing that margin could not
provide a protected header/content boundary.

## Architecture correction

`.shell-content` is now a viewport-height grid: `auto minmax(0,1fr)` rows and
`row-gap:var(--header-content-gap)` (20px). Only the appropriate desktop/mobile
header occupies row 1, in relative normal flow. A named, keyboard-focusable
`.shell-scroll` region occupies row 2 and contains main plus footer. Its
`overflow:auto` clips scrolling descendants at its top. Header and clearance
are outside the scroller. Desktop frame insets and dynamic sidebar widths are
unchanged. Mobile reserves the fixed bottom tabs including the safe area.

Removed the previous `#content` top margin; main top padding remains zero.
There is exactly one gap authority: the shared grid row-gap. No route margins,
fixed-header compensation, extra dependencies or processing changes were added.

## Before/after measurements

Same viewport 1900×1000, at page arrival:

| Measurement | Before | After |
|---|---:|---:|
| Header top | 24px | 24px |
| Header height | 68px | 68px |
| Header bottom | 92px | 92px |
| Main top | 112px | 112px |
| Gap | 20px | 20px |

After 80px of content scrolling:

| Measurement | Before (window scroll) | After (content scroll) |
|---|---:|---:|
| Header top | 0px | 24px |
| Header bottom | 68px | 92px |
| Raw main descendant top | 32px | 32px |
| Protected scrollport top | none | 112px |
| Raw main top − header bottom | −36px | −60px (clipped descendant) |
| Visible content begins below header | No | Yes, 20px clearance |

An offscreen main rectangle is not a painted boundary: the new scroll region
clips it at y=112. Regression tests check `elementFromPoint()` in the gap,
the region's overflow, actual scroll offsets, and header/scrollport rectangles.
This is the distinction missing from the earlier arrival-only verification.

The new brief refers to comparison screenshots but attaches no new image files.
No new reference-site measurement is claimed. The correction retains existing
colors/type and the specified 20px rhythm, rather than inventing extra spacing.

## Scope and evidence

Files: `SiteShell.tsx`, `public-site.css`, `header-spacing.e2e.mjs`, `DESIGN.md`,
this report. Previous tests and reports remain historical evidence.

Production captures and measurements are in `output/header-root-cause/final/`:
home collapsed/expanded, tool workspace, Command Center, mobile homepage and
`after-scroll-80.png`. Before/after development captures use exactly 1900×1000.
Production matrix uses every requested viewport dimension, plus 1900×1000;
home, tool directory and four category filters, Image Compressor, Command
Center, Privacy, Supported Formats and all 28 individual workspaces.

The document intentionally no longer scrolls for public pages: header stays
visible while the content/footer region scrolls. Keyboard and native in-page
anchors must operate inside that region. Physical-device and screen-reader
speech testing are not claimed.

Final verification results are appended below after completion.

Keyboard verification in production: focusing Page content and pressing
Page Down moved the region by 721px at desktop width 1900 and 714px at mobile
width 390; document scroll remained independent. The initial new matrix
passed 759/759 checks. During coverage review, the previous catalog regex
was found to discover only 17 routes due to differing source formatting.
The committed test now discovers all 28 page directories directly; a final
full run records the corrected coverage below. An auxiliary measurement run
was interrupted when the first matrix correctly shut down its owned server;
no partial auxiliary result is counted as successful coverage.

## Final verification

- npm run build: passed, exit 0.
- npm run check: passed, exit 0; TypeScript, ESLint and 84 unit tests (14 files).
- Final header-spacing.e2e.mjs: 770/770 checks passed, all 28 actual tool pages.
- npm run e2e: passed, exit 0, 496/496 existing checks: shell 158,
  redesign 89, Command Center 15, photos 44, passport 13, HEIC 11,
  background removal 13, video compressor 37, media 43, local tools 39,
  notes 14 and PDF-to-audio 20.
- Final unique browser checks: 1266/1266; earlier matrix repeats excluded.
- All 100 route/viewport measurements have 20px arrival separation and 20px
  protected header-to-scrollport separation after scrolling.
- Mechanical design scan: 18 existing typography advisories, no new shell
  defects reported. Existing typography was deliberately preserved.

Logs: build.log, check-final.log, browser-complete.log and e2e.log under
output/header-root-cause/. Full final geometry: final/measurements.json
(x/y represent left/top). Production after-scroll-80.png and the before-80.png
capture are the matched scrolled comparison. Screenshot inspection included
initial desktop, scrolled desktop and mobile. No paid services, new models,
media engines or excluded editor routes were modified.
