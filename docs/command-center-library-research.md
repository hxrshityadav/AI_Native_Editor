# Component library review (Reel Finisher 2.0)

Reviewed on 7 November 2026 from each library's own site. **No source code from any of these libraries was copied or installed.** Because nothing was copied, no attribution is owed. The Command Center, palette, buttons and homepage fragments are written for this repository on its existing primitives (`buttonClass`, native `<dialog>`, `<details>`, native form controls).

| Library | What it offers | Terms found | Decision |
|---|---|---|---|
| Skiper UI (skiper-ui.com) | Premium buttons, scroll effects, image reveals, page transitions; installed with the shadcn CLI | Free components need attribution; Pro components need a licence key; they depend on `framer-motion` | **Not imported.** It would add a second animation runtime next to GSAP, and its showcase effects (liquid, shine, magnetic) are out of place on file-processing screens. Paid components were not opened. |
| Vengeance UI (vengenceui.com) | Animated CTAs, glow, spotlight nav, text reveal, bento layouts | Open source; built on Framer Motion | **Not imported.** Same runtime overlap, and glow and bento conflict with the design system's no-glow, no-card-grid rules. Its text reveal was matched with GSAP and line masks instead. |
| Watermelon UI (ui.watermelon.sh) | 600+ free React/Tailwind/shadcn components, dashboards, command interfaces | Free for personal and commercial use; shadcn CLI | **Not imported.** Its dashboard blocks centre on charts and metrics that this product doesn't have (no invented statistics). The palette and rail were built on the existing native-dialog primitives instead. |
| Bencho (bencho.dev) | Command bar, upload dropzone, progress tracker, comparison slider, toast stack | Paid (Bencho Pro, €99/year or €129 one-time); no credit required; no redistribution | **Not used.** It needs a paid licence, which this project doesn't hold. The product already has working equivalents: `FileDropzone`, `ProcessingPanel` with real progress, and `BeforeAfterComparison`. |
| GSAP 3.15.1 (gsap.com) | Timelines, ScrollTrigger, matchMedia | Standard no-charge licence (free, including commercial use); SplitText not used | **Used**, on the homepage only, imported after hydration (`src/components/site/home/HomeMotion.tsx`). |
| shadcn/ui patterns | Accessible primitives | MIT | **Kept** as the existing native-element adaptation (`src/components/site/ui.tsx`). No Radix install was added. |

## Patterns adapted (ideas, not code)

- **Command bar** (Bencho, Watermelon): Ctrl/⌘ K palette with category filters, arrow-key selection, Enter to open, Escape to close and focus return. One global instance, mounted by the site shell.
- **Collapsible sidebar** (Bencho): the existing sidebar keeps its remembered collapse state and gains the palette launcher.
- **Text reveal** (Vengeance, Skiper): headline lines rise out of overflow masks, done in GSAP without SplitText.
- **Filter chips and spotlight selection**: blue selected state with an outline, no glow.
