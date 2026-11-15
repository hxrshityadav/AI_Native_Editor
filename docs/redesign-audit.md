# Public redesign audit — 2026-11-04

## Boundary and source of truth

Read the user's complete redesign brief, AGENTS.md, CLAUDE.md, repository skill guidance, installed Taste Skill and Impeccable instructions, current catalog, shared shell, homepage, directory, public legal/format pages and tool surface components. Reference delivery/model documents describe implementations; the source catalog determines what is offered. Existing uncommitted work predates this redesign and must be retained.

All standalone tool pages compose ToolPageLayout and/or ToolSurface. Photo/video previews and controls, waveform/audio tools, transcript/notes screens and speech/document tools remain specialized components. Changes should reach those shared visual seams without touching media engines. SiteShell is only imported by public surfaces; Studio has its own frame. Global studio tokens must not change.

No blog, category landing routes or pricing page currently exist. Do not invent them; category discovery uses the existing directory filters and anchors.

## Subject inventory

Reel Finisher's finishing ritual; original files remain on-device; measured bytes instead of promised savings; source versus result previews; ten-minute source ceiling; explicit optional model consent; named Light DSP versus Neural RNNoise; generic English downloadable speech versus device listening; selectable PDF text without OCR; source-based lecture notes; separate Shorts-to-Studio handoff; recoverable local Studio projects.

## Homepage argument

- Media finishing in the browser: name the product and offer tool discovery and Studio.
- See what the tools do: a real, user-operated fragment, with no invented success metrics.
- Choose a medium: photo, video, audio and AI links from the catalog.
- Understand the local workflow: choose, configure, review, download; model consent is explicit.
- Find limitations: link privacy, supported formats and model disclosures.

## Incumbent weaknesses to validate in screenshots

The homepage's start list renders every utility alongside a short introduction, stretching the opening region. Repeated icon tiles, bordered cards and nested containers compete with media. System typography provides little product identity. Tool discovery repeats the entire catalog on the homepage. Tool headers and secondary content consume attention that belongs to the task.

## Direction exploration

Taste Skill dealt One Motif, Quiet Instrument and Product Performs. Product Performs is the proposed direction: the actual local finishing workflow can be the homepage's live material. One Motif risks decorative repetition; Quiet Instrument's narrow/empty composition conflicts with this brief's density and discovery requirements.

Direction sheet: `.taste-skill/direction.json`, seed 1893595705. App sheet: `.taste-skill/app/direction.json`. The dealt Switzer face is not present locally; font selection must be licensed and self-hosted. The sheet's optional fog photographs do not prove this product and are unnecessary under the user's preference for real UI and media. No stock imagery is planned.

Idea: on this page, Reel Finisher's source-to-measured-result finishing ritual becomes the live product demonstration. Any demo data must be computed by the existing engine or labelled as a demonstration. No static percentage may masquerade as measured processing.

## Surface map

| Surface | Design task | Preserved behavior |
| --- | --- | --- |
| Homepage | Original first screen, focused working demonstration, selected discovery | Canonical origin, Studio/tool destinations, truthful claims |
| Site shell | Quiet desktop navigation, mobile dialog, product identity, footer | Catalog synchronization, search, collapse preference, keyboard dialog |
| Tools directory | Search-first discovery and readable category collections | Query/filter URL state and availability |
| Photo/video utilities | Media stage + compact settings + explicit result | Existing image/video workers, size search, codec checks and output |
| Audio utilities | Listening/waveform-first controls | Genuine waveform/playback and export |
| Speech/AI/creator tools | Text/transcript/model choice hierarchy | Consent, limits, local engines and Studio handoff |
| Privacy/formats | Readable content and wayfinding | Policy meaning and supported-format qualifications |
| Studio/Legacy/Lab | Excluded | Entire implementation and UI |

## Validation plan

Capture incumbent and final screenshots with Taste Skill; inspect all requested widths. Audit keyboard/mobile navigation, selected files, processing, results, errors, model consent and network behavior. Run source/rendered detectors, repository check, fresh build, E2E and relevant model suites. Record actual results in the final design implementation report. No validation is marked passed by this planning document.
