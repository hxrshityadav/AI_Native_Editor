# Dynamic sidebar and content layout

The root cause was intentional permanent reservation from the earlier brief:
`.app-frame` always used a 232px sidebar column, while the capsule independently
animated between 56px and 208px. Content could never reclaim the reserved space.
The new brief supersedes that behavior.

## Architecture

One existing state attribute, `data-sidebar="expanded"`, now switches the actual
grid track from 72px to 224px. Tracks are `var(--rail-width) minmax(0,1fr)`.
The grid transitions for the existing 220ms token. The sidebar has 8px horizontal
padding, and its capsule fills the track's content box: 56px / 208px. Its separate
width animation is removed. No scale, translate, overlay or separate main-width
state is used. The fine-pointer hover, keyboard, touch and drawer behavior stays.

The header, page and footer already share one content column. They now inherit
its changing width; `main` and `.shell-content` permit shrinking. Intentional
reading widths remain. The top search field can flex with its header. The
existing frame maximum controls outer ultrawide insets rather than constraining
individual pages. No unnecessary fixed page max-width was found in the current
homepage, directory, tool or Command Center wrappers.

The shell is a named inline-size container. Homepage columns stack below 900px
of available workspace, and the bench stacks inside a main column below 620px.
ToolSurface responds to its actual container below 860px, with stacked action
footers in normal flow. Footer columns remain responsive grids in the same
content column. Desktop layout is removed below 1024px; the native drawer remains.

## Changed files

- `src/components/site/public-site.css`: grid state, shared shrinkable wrappers,
  synchronized capsule sizing and flexible search.
- `src/components/site/public-motion.css`: shared grid transition.
- `src/components/site/Sidebar.tsx`: correct architecture comment; state/handlers
  and processing behavior are unchanged.
- `src/components/site/home/home.css`: available-width homepage and bench layout.
- `src/components/tools/surface/ToolSurface.module.css`: container-responsive surface.
- DESIGN.md and browser tests, including new `dynamic-sidebar.e2e.mjs`.

No dependency, processing engine, worker, upload/download, model delivery,
catalog route or excluded editor source was changed.

## Evidence and verification

Initial dynamic matrix passed 124/124 across 1600, 1440, 1280, 1024, 768, 430,
390 and 360px, on homepage, Image Compressor and Command Center. Actual rectangles
show the column growing 72→224px and main/header/footer narrowing by 152px,
then recovering 152px on leave. Homepage grid width responds by the same amount.
Both states are checked for sidebar clearance and horizontal overflow. Mobile
checks verify the hidden desktop column consumes zero width, the page uses the
viewport and the modal drawer restores focus.

Geometry JSON and same-viewport screenshots are under `output/dynamic-sidebar/`.
Final screenshot reruns decode lazy images before capture so offscreen unloaded
images are not confused with broken UI. No full-page screenshot is used as a
background in the application.

Initial `npm run check` and production build passed with 84 unit tests. Final
regression totals are appended after completion. Physical-device testing,
screen-reader speech evaluation and low-memory device performance are not
claimed. Actual grid interpolation causes layout reflow by design; no
compositor-only or zero-layout-shift claim is made.

Final verification: production build passed; npm run check passed (TypeScript,
ESLint with no warnings and 84 unit tests). Dynamic width matrix 124/124;
updated hover/focus/touch/reduced-motion suite 76/76; npm run e2e:site 262/262.
These total 462/462 browser checks across the completed runs. A second dynamic
matrix with every static image decoded also passed 124/124; it is a repeat,
not added to the unique-check total.

At 1440px, main and header widths changed 1320→1168px. Footer width changed
1272→1120px. All three recovered exactly on collapse, on homepage, Image
Compressor and Command Center. Complete evidence is in measurements.json.
Final fully decoded screenshots are in output/dynamic-sidebar-decoded/;
1440-_-collapsed.png and 1440-_-expanded.png are a matched homepage pair.
Homepage screenshots were visually reviewed in both states, including the
1024px expanded stacked layout. No production rebuild ran during the final
browser suites. Engines and broader media/model suites were not changed or
re-benchmarked; actual sample JPEG/PNG/WebP downloads, cancellation and retry
were exercised by the site suite.
