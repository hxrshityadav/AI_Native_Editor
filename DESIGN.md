---
name: Reel Finisher
description: A command-led media workstation in black, electric blue and orange, with real media at the center.
colors:
  canvas: "#08090b"
  sunken: "#0d1015"
  surface: "#121720"
  field: "#181f2b"
  hover: "#1d2533"
  edge: "#252d3a"
  control-edge: "#566176"
  ink: "#f5f7fa"
  secondary-ink: "#d3d9e2"
  muted: "#a0a9b7"
  faint: "#8b95a6"
  blue: "#4d88ff"
  blue-strong: "#246bfd"
  blue-deep: "#143c91"
  blue-surface: "#101d35"
  focus: "#5b93ff"
  primary: "#ff6b35"
  primary-hover: "#ff824d"
  primary-press: "#e85a27"
  on-primary: "#08090b"
  success: "#5bd69a"
  warning: "#ffb86b"
  error: "#ff7a70"
typography:
  display:
    fontFamily: "RF Display, Mukta, sans-serif"
    fontSize: "clamp(2.25rem, 6.6vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "RF Display, Mukta, sans-serif"
    fontSize: "clamp(2rem, 3.4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.04
  title:
    fontFamily: "RF Display, Mukta, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.1
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.55
  control:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  metadata:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    lineHeight: 1.5
rounded:
  control: "8px"
  surface: "14px"
  chip: "999px"
spacing:
  tight: "8px"
  control: "16px"
  panel: "24px"
  section: "clamp(96px, 11vw, 168px)"
motion:
  ease-out: "cubic-bezier(.16,1,.3,1)"
  fast: "140ms"
  base: "220ms"
  slow: "600ms"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    height: "44px / 48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.blue} at 55%"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  button-destructive:
    backgroundColor: "#33110f"
    textColor: "{colors.error}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
---

# Design System: Reel Finisher

## Overview

**Creative North Star: "The Command-Led Workstation"** (Reel Finisher 2.0, November 7, 2026. It replaces the November 5 charcoal-and-amber "Finishing Bench" look and keeps its working bench.)

The product performs. The homepage hero is the real worker-backed compression bench, and the Command Center section is a working slice of the real catalog search. Public tools share layered near-black surfaces and electric-blue selection and focus. Orange is reserved for the action that moves the work forward. Actual photos, clips, waveforms, documents and transcripts provide the visual material.

Operate surfaces prioritize the task. Read surfaces prioritize comprehension. The public identity is scoped to `.site`; the Studio family has its own design and is excluded.

**Key Characteristics:**
- A visible source, intentional settings and a measured result.
- Flat tonal layers and restrained color.
- Locally bundled display typography paired with native control readability.
- No fabricated proof, ornamental progress or automatic model loading.

## Colors

Black dominates. Canvas, sunken, surface, field and hover form five near-black steps that separate regions by tone, not lines.

**Blue** marks where you are and what is selected: current navigation, selected chips and segments, ranges, focus rings and secondary buttons. One full blue-deep field holds the homepage privacy statement.

**Orange** marks what to do next: the primary button, the browse, process and download actions, real progress bars, and the pinned-star state.

Status colours always come with text.

**The One Action Rule.** One orange fill per decision point. Blue never fills a primary action, and orange never marks a selection. The single token source is `.site` in `src/components/site/public-site.css`. Tailwind utilities (`bg-brand`, `bg-accent`, …) read the same variables through `globals.css`. Studio tokens are not changed.

## Typography

**Display Font:** RF Display, the existing locally bundled Mukta Bold Latin subset under SIL OFL 1.1. Its compact proportions connect public identity to the product's caption heritage without loading editor code.

**Body Font:** System UI stack, selected for native form readability and zero extra downloads. **UI/control font:** the same stack at a smaller, medium-weight step. File sizes, dimensions and times use tabular figures instead of decorative monospace.

Display and headings establish hierarchy; running copy uses the body step. Model caveats and file metadata remain readable smaller text. Mobile headlines adapt without clipping.

## Layout

Desktop uses a 224px collapsible sidebar and a centered content region: 1240px for tools, 1320px for the homepage and Command Center. Gutters scale from 20px to 48px. Below 1024px, the sidebar becomes the existing accessible modal navigation drawer.

The homepage bench uses a flexible media column plus a 280px settings column with a 24px gap. Below 768px it stacks media above controls. Tool workspaces use a flexible preview plus a 320px control column; they stack on narrower screens. Transcript, speech and PDF tools retain their specialized layouts and controls. Tool support content follows the workspace, with larger separation between sections than within a control group.

## Elevation & Depth

Surfaces are flat at rest; differences in lightness carry depth. Only true overlays (the command palette and dialogs) carry `--shadow-2`. No decorative shadows, glows or glass. Fields keep visible boundaries. Focus uses a two-pixel outline with an offset; file-picker labels also expose focus-within.

## Shapes

Controls use modest corners; working surfaces use larger corners. Repeated icon tiles are removed. Transparency checkerboards and waveform marks remain functional information, not background ornament.

## Components

### Buttons

`buttonClass(variant, size)` is the only button system. Its variants are `ds-primary`, `ds-secondary`, ghost and `ds-destructive`.

- **Primary:** orange fill with black text. Hover brightens it; press darkens it and scales it to 98.5%.
- **Secondary:** dark surface with a blue border. Hover fills it with blue-surface.
- **Ghost:** text only.
- **Destructive:** red text on a red-tinted surface.

A trailing arrow moves 3px on hover. Shine, glow, liquid and magnetic effects were tried and rejected for file-processing screens. Busy buttons use `aria-busy`. Downloads remain real links to validated blobs.

### Inputs / Fields

Dark fields with a visible neutral stroke and inherited ink. Native labels, sliders, radio semantics and keyboard interactions are preserved. Lossless PNG disables quality control in the bench.

### Navigation

The catalog remains the source of truth. The current destination uses the blue surface with a blue icon. One global command palette searches the catalog; Ctrl/⌘ K or the launcher in the sidebar and phone header opens it. The desktop collapse preference, mobile focus trapping, Escape and return focus still work.

### Command Center

`/command-center` (noindex) has a section rail: Overview, All tools, Photo, Video, Audio, AI Studio, Favorites, Recent activity and Settings. Below 1024px the rail becomes a horizontal strip. Each view has its own hash link. Favorites and recent visits store routes only, versioned, in this browser. When storage is blocked, the page shows a recovery message and keeps working for the session.

### Media Bench

The sample is explicitly generated demonstration media. Worker import and processing begin only on request. Every byte count and saving comes from an actual output Blob; changing settings invalidates the old result. Original and result use the same viewport crop, and full dimensions are retained in the download.

### Tool Workspace

Shared surface pieces handle file metadata, previews, settings, processing, warnings and result comparison. Specialized tool components retain their own processing state and engine. Informational messages recede; failures and recovery remain prominent.

### Workflow illustrations

Stageshow stills introduce photo, video, audio and caption workflows in discovery
surfaces. Their charcoal windows and orange selections sit inside the black-and-orange system. Desktop
and mobile have separately composed images; their pixels never replace live
controls or measured results. Illustrations are labelled, lazy-loaded, decorative
to assistive technology, and pre-rendered so no Stageshow runtime ships. Shared
tool headers link to the workspace, instructions and their real category.

## Do's and Don'ts

- **Do** put the user's media and primary task first.
- **Do** preserve local processing, cancellation, limits, integrity checks and cleanup.
- **Do** use the real catalog and truthful capability descriptions.
- **Do** respect reduced motion, keyboard access and native semantics.
- **Don't** add stock images or autoplay footage just to satisfy an image/motion count.
- **Don't** turn computed measurements into static marketing claims.
- **Don't** style Studio by changing root tokens or shared editor components.
- **Don't** add decorative AI badges, gradients or nested icon cards.

## Motion

GSAP 3.15 runs on the homepage only, under its standard no-charge licence, and is imported after hydration:

- The headline lines rise out of their own masks.
- The lead and the actions follow.
- The real bench settles into place.
- Each section's parts enter once as it scrolls into view.
- The bench sample drifts slowly with the scroll.

Everything is visible in the server HTML. `gsap.matchMedia` skips all of it under reduced motion, and the context is reverted on unmount. SplitText is not used.

Elsewhere, CSS transitions handle hover, press, the palette opening and the FAQ icon rotation. Processing progress only ever comes from real pipeline events.
