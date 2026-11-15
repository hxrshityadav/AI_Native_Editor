# Header/content shell spacing — 14 November 2026

## Root cause and correction

Chrome baseline inspection of the current development server at 1920×1080
found the same geometry on home, directory, Image Compressor and Command Center:
header top 24px, height 68px, bottom 92px; `#content` and `main` top 92px.
The structural gap was 0px. Visible first children began at 108px because main
had 16px top padding. The header was sticky and in normal flow, not fixed or
absolutely positioned. There was no missing fixed-header compensation.

The shared `#content` flex item now owns `margin-block-start` through
`--header-content-gap:var(--space-5)` (20px). Flex-item margins do not collapse.
Main top padding is zero, including the old mobile override. This creates an
actual positive gap between header and main bounding boxes on every route,
without per-page patches or duplicating spacing. Desktop main starts at 112px;
mobile main starts at 80px below its 60px header. Visible content moves 4px
relative to the old 16px inner padding.

At 1024px the first production matrix also reproduced a 2px header-height
increase on expansion: the Command Center action wrapped when its flex cluster
shrunk. The cluster now has `flex-shrink:0` and `white-space:nowrap`, allowing
the existing flexible search control to shrink instead. Sidebar state, motion
and widths are unchanged. The current working tree uses a 56→200px capsule,
80→224px allocated column and 144px content-width transfer. Existing site-suite
assertions still expected the previous 208px/152px geometry; they now derive
expected values from the authoritative CSS tokens.

The brief refers to two comparison screenshots, but no new screenshot files
were attached to this request. The 20px value follows its explicit 16–24px
target and the existing system's spacing scale; no new pixel measurement of
the reference website is claimed.

## Changed files

- `src/components/site/public-site.css`: shared gap, remove main top padding,
  keep the header action cluster on one line.
- `tests/e2e/header-spacing.e2e.mjs`: production bounding-box matrix, all tools,
  sidebar-width restoration, sticky scrolling, mobile drawer and captures.
- `tests/e2e/site.e2e.mjs`: read current sidebar tokens in existing assertions.
- `DESIGN.md`: final shared spacing specification.
- This report.

## Coverage and evidence

The spacing matrix covers 1920, 1600, 1440, 1280, 1024, 768, 430, 390 and 360px.
Routes: home, all tools, photo/video/audio/AI directory filters, Image Compressor,
Command Center, Supported Formats and Privacy. All 28 tool workspaces are also
measured at 1440px. Expanded/collapsed comparisons assert the same vertical
header/content coordinates while allowing the explicitly requested horizontal
grid resizing. Scrolling checks sticky headers. Mobile drawer checks opening,
Escape dismissal and focus restoration.

`output/header-spacing/measurements.json` contains actual rectangles and gaps.
Captures include `1920-_.png`, `home-expanded.png`,
`1920-_tools_image-compressor.png`, `1920-_command-center.png`, and `390-_.png`.
Desktop and mobile homepage captures were visually inspected.

## Limits

Viewport automation is Chrome desktop, not physical-device testing. Sticky
headers naturally cover document content as it scrolls behind them; the 20px
relationship describes page arrival, not a permanent empty strip while scrolling.
No engine, worker, model delivery, upload/download behavior or excluded editor
path was changed. Mechanical design detection reported 18 pre-existing font-size
advisories in the shared stylesheet; typography remains outside this correction.
Final command results are recorded below after the regression run.

## Final shell results

- npm run build: passed (final production build).
- npm run check: passed (TypeScript, ESLint, 14 test files / 84 unit tests).
- node tests/e2e/header-spacing.e2e.mjs: 489/489 checks passed.
- Public site portions of npm run e2e: 158/158 shell, 89/89 redesign,
  15/15 Command Center (262/262 total).
- Photo portions: 44/44 photo utilities, 13/13 passport, 11/11 HEIC,
  13/13 background-removal checks (81/81 total).

Final measured homepage bounds: at 1920px and 1024px, header y=24, h=68,
end=92, main y=112 (gap 20px). At 390px, header y=0, h=60,
end=60, main y=80 (gap 20px). All 90 route/width measurements in the
matrix have a 20px gap. Sidebar expansion preserves header and main y.

Earlier attempts: an existing screenshot file rejected overwrite with a Windows
UNKNOWN error; a fresh output folder resolved it. The first matrix reproduced
the narrow-header wrapping issue and the first site run caught stale sidebar
assertions. Those failures are retained in earlier logs, with final successful
runs recorded separately. No application error was hidden or weakened to pass.

Final complete npm run e2e: exit 0, 496/496 checks across all existing groups.
Video compressor 37/37; media utilities 43/43; local tools 39/39;
lecture notes 14/14; PDF-to-audio 20/20, in addition to the site and photo
results above. Combined with the new matrix: 985/985 browser checks.
Model inference suites and physical hardware were not certified by this CSS
change; local suites retain their existing model mocks/consent coverage.
Final log: output/header-spacing-e2e-final.log. No new dependencies.
