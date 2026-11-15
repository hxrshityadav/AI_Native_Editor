# Hover capsule and shared public motion

## Installation

Ran official `npx motion-ai` (14.2.0), selecting **Project**, **Claude Code**,
and install. `/motion` is in `.claude/skills/motion/SKILL.md`; accompanying
best-practice references and `.claude/agents/motion-reviewer.md` were installed.
Read the skill, CSS-or-Motion decision guide, universal performance/accessibility
rules and React guidance before implementation. `.mcp.json` configures the free
documentation server at `https://mcp.motion.dev`; `claude mcp list` reports it
**Connected**. The installer also offered/configured Motion+ automatically; that
unauthenticated entry was removed. No paid feature, sign-in, runtime Motion,
GSAP or other animation dependency was added. The existing unrelated Figma
connection was not changed.

This Codex session has no Motion MCP tool namespace. A direct documentation-tool
probe failed DNS; no successful Motion MCP search is claimed. Public official
AI Kit and quick-start pages were read through browsing and installed guidance
was used directly. Claude Code discovery/connectivity was verified through its
CLI; a billable Claude inference session was not launched. The official skill is
available to Claude Code as `/motion`. MotionScore requires Motion+ and was not
run or assigned an invented grade.

Sources: https://motion.dev/docs/ai-kit and https://motion.dev/docs/quick-start.

## Sidebar

The desktop grid always reserves 240px; the visible capsule alone changes between
60px and 216px. Default is collapsed, independent of old saved width choices.
Old preference records are left intact. Removed the old pre-paint sidebar script
that could briefly expand a saved preference. The theme script is unchanged.

Mouse entry on a hover-capable device opens after 100ms; pointer leave closes
after 300ms. One timer is cleared on re-entry, focus changes, toggles and unmount.
Movement between child links does not fire repeated sidebar enter/leave events.
Focus on a link opens immediately and holds expansion until both focus and
pointer have left. The dedicated toggle supports touch and keyboard; explicit
collapse is allowed. No global pointer tracker, animation-frame state updates,
background animation loop or per-frame DOM measurement runs in product code.
Below 1024px the native drawer retains dismissal, scroll lock and focus return.

## Motion system

`src/components/site/public-motion.css` is the shared public-only timing source:
100ms press, 140ms feedback, 150ms labels, 160ms menus, 200ms dialogs, 240ms
drawers, 250ms sidebar, 260ms disclosure. Existing ease-out handles entrances;
`cubic-bezier(.4,0,.2,1)` handles reversible transitions without bounce.

CSS handles active/hover/press feedback, theme surfaces, palette entrance, drawer
entrance/backdrop, supported native disclosure sizing, favorite state color,
directory empty feedback, and workspace message/result/working-control opacity.
The actual media stage and processing pipeline are not animated or changed. No
synthetic progress, automatic scroll choreography or entrance cascade was added.
Reduced-motion CSS disables animation and transition movement, including backdrops.

Width animation is deliberately confined to one small navigation capsule; it is
a layout property, not claimed compositor-only. The page grid never animates.
React presence/exit choreography did not justify a new runtime: native dialogs
close immediately with correct focus restoration. Enter feedback progressively
enhances their existing semantics. Motion React/AnimatePresence is not used.

## Changed files

`Sidebar.tsx`, `SiteShell.tsx`, `public-site.css`, new `public-motion.css`,
`ToolFinder.tsx`, `ToolSurface.module.css`, DESIGN.md and relevant browser tests.
Tool engines, uploads/downloads, model/cache delivery, routes and excluded editor
directories were not changed. No npm dependency or lockfile change is required.

## Validation

`npm run check` and `npm run build` passed; 84 unit tests passed and lint/typecheck
were clean. Dedicated hover tests sample main geometry on animation frames and
exercise enter delay, leave delay, re-entry cancellation, focus retention, touch
toggle, drawer dismissal and reduced motion. Eight widths: 1600, 1440, 1280,
1024, 768, 430, 390, 360. Geometry evidence/screenshots:
`output/hover-sidebar/`. Final totals are appended after regressions complete.

This is local Chromium viewport/touch emulation, not physical-device testing or
a low-powered-device benchmark. No MotionScore score, frame-rate guarantee or
physical-device smoothness claim is made.

Visual review found that an initial CSS specificity conflict clipped expanded
labels despite correct capsule width. Corrected the selector and added explicit
label-width/opacity assertions at all desktop widths. Final label-aware hover
matrix: 64/64. Actual expanded/collapsed screenshots were viewed after the fix.
Every sampled main-content rectangle stayed identical across all captured frames
at 1600/1440/1280/1024px (geometry.json records exact frame counts). No FPS or
low-memory performance inference is made from that measurement.

Final browser regressions completed serially against the finished build:
- hover/timing/focus/touch/reduced-motion matrix: 64/64;
- npm run e2e:site: 262/262 (158 public shell, 89 routes and actual sample outputs,
  15 Command Center);
- existing light/dark capsule matrix updated for focus expansion: 86/86.
Total: 412/412 browser checks. Final build and npm run check passed (84 unit tests,
zero lint warnings, clean TypeScript). The broader photo/video/local-model suites
were not rerun in this interaction-only task; actual JPEG/PNG/WebP sample export,
retry and cancellation were exercised by the site suite. Earlier partial browser
runs were not counted. Screenshots were visually inspected after the label fix.
