# Layout, width, footer and frame refinement (8 November 2026)

A targeted pass on the shared shell. The design direction and palette are unchanged, and no engine code changed. Uncommitted.

## Root causes (measured with `getBoundingClientRect` and `getComputedStyle` on the running site)

| Problem you saw | Measured cause | Owner |
|---|---|---|
| Square top-right corner | The sticky `.top-bar` is a square box in the frame colour, pinned at viewport `y = 0`. Once scrolled, it painted over the 24px inset and the frame's rounded corners. Scrolling also moved the frame's own corners out of view. | `.top-bar` (sticky) plus the frame having no persistent corner treatment |
| Header, content and footer not aligned | Three independent width calculations. At 1863px the top bar spanned 120–1839 (controls ending at 1815), `main` was centred at 344–1616 by its own `max-width: 1320px`, and the footer panel spanned 144–1815 with an inner 1320px container at 320–1640. | `.site main`, `.home-page`, `.directory-page`, `.command-center-page`, `.footer-inner` max-widths, plus the footer's own margins |
| A 224px empty strip between the rail and the content on wide screens | The centred 1320px `main` inside a wider content column | Same |
| Footer detached, with large gaps | A two-level layout: brand (1fr), then a nested five-column grid (3fr), 40px padding, a 40px outer gap, and margins differing from `main` | `.footer-inner`, `.footer-columns` |
| Privacy title lower than on other pages | `.reading-page { padding-top: 48px }` overrode the shared top spacing | `public-site.css` |

## Layout architecture changes

- **Width:** `.app-frame` is the only width owner: `width: calc(100% - 2 × --frame-inset)`, `max-width: --frame-max` (1760px), centred. Its grid is `[--rail-width | content]`.
- **One inset:** the top bar, `main` and the footer use the same `--page-inset` (24px, or 16px on phones). All per-page `max-width`s were removed: `main`, home, directory and Command Center.
- **Frame corners:** a single fixed `.frame-mask` rendered by `SiteShell` (`pointer-events: none`, z-index 48, below top-layer dialogs). Its `::before` matches the frame rectangle and casts `box-shadow: 0 0 0 100vmax var(--canvas)`. Everything outside the rounded rectangle shows the page colour, so all four corners stay rounded while the content scrolls under the sticky top bar. Nothing is clipped, so menus, the palette and dialogs are unaffected.
- **New tokens:** `--frame-inset`, `--frame-max`, `--rail-width` and `--page-inset`, alongside the existing spacing, radius and control tokens.

## Footer

One six-track grid: brand at 1.6fr and five link columns at 1fr each, with the link columns sharing the tracks through `subgrid`.
- 32px padding and 24px gaps, with a 4px gap between links on a 32px line.
- The first row is 32px, so the wordmark and the headings align.
- Responsive: three columns with the brand on top below 1280px; two columns below 768px.

## Homepage width

The main and side columns now fill the content column. When the main column is wider than 1000px (container query), the category cards flow four across instead of growing into oversized 2×2 cards.

## Files changed

- `src/components/site/public-site.css`: tokens, frame, mask, top bar, main, footer, reading-page offset.
- `src/components/site/SiteShell.tsx`: the frame-mask element; frame grid columns move to CSS.
- `src/components/site/home/home.css`: removed `max-width`; category container query.
- `src/components/command-center/command-center.css`: removed `max-width`.
- `DESIGN.md`: shell architecture and footer specification.

## Verification (dev server, Chromium; measured, not estimated)

- **Edges:** all eight public page types (home, directory, Image Compressor, Video Compressor, Audio Cutter, Command Center, Privacy, Supported Formats) × 1440/1280/1024/768/390/360 pass, 48 of 48. Each has no horizontal overflow; the footer's left and right edges equal the content edges; the search pill's left edge equals the content edge.
- **At 1863px:** search, hero and footer all start at x=172; the top-right controls, content and footer all end at x=1788. At 1440: 144 / 1392.
- **Footer columns:** evenly spaced (185px tracks at 1440, 241px at 1863). The bottom gap to the window is 48px on desktop (frame inset plus page inset) and 88px on phones for the tab bar.
- **Corners:** the scrolled capture at 1863px shows all four frame corners rounded.

Screenshots in `output/design-reference/`:
- `audit-scrolled-1440.png`, `audit-scrolled-1863.png`: scrolled corners.
- `footer-{1440,1863,1024,768,390,360}.png`: the footer at each width.
- `sweep-*-1440.png`: the other pages.

## Tests

- `npm run check` (typegen, `tsc`, ESLint, Vitest): **passed**, 84 tests.
- **Not run:** the production build and E2E suites. They need your dev server on port 3000 stopped, and you asked to leave it running.

## Remaining visual issues

- The Privacy page's in-page contents list is inset 12px (its link padding) from the title edge.
- The Stageshow category illustrations keep their pre-rendered orange highlights.
