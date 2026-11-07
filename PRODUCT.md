# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Casual users and creators preparing photos, short videos, audio, captions and learning materials. Standalone tools serve a focused task; Reel Studio serves timeline editing.

## Product Purpose

Professional media tools. Right in your browser. Help someone select a tool, process their own file, review a real result and download it without unnecessary accounts or software installation.

## Positioning

A free-first, local-first media toolkit. Core tools process user media in the browser, with optional explicit downloads for supported local AI models. No mandatory paid provider or account for basic operations.

## Operating Context

Next.js and TypeScript public website, shared standalone tool surfaces and workers, and a separate pinned OpenReel browser editor. Source availability is maintained in `src/lib/tools/catalog.ts`; limitations and evidence are documented in `docs/tools-matrix.md` and `docs/production-readiness-report.md`.

The November 6 Reel Finisher 2.0 brief adds a Command Center for tool discovery,
favorites and local route-only recent activity, without mandatory accounts.
User-selected surface direction: command-led workstation. Browser-local preference
storage is optional; blocked storage must have a clear recovery path. This surface
does not claim to observe processing jobs inside unrelated tools or Studio.

## Capabilities and Constraints

- Image compression, resizing, conversion, HEIC conversion, subject cutout and passport crops.
- Video compression, trimming, conversion, audio removal, GIF creation and Studio handoff.
- Audio conversion, cutting, gain, extraction and cleanup; stereo centre/side tools are not neural stem separation.
- Optional local Whisper, English SpeechT5, RNNoise and PDF.js. Models require consent; downloading a model does not upload media or text.
- Ten-minute video limit remains. Individual tools may impose lower limits. Browser codecs, memory and storage constrain support.
- Generated sizes must be measured. Progress must come from the pipeline. Errors must explain recovery. No fake controls or proof.
- Studio, Studio Legacy and Lab are excluded from the public redesign. Existing engines, cancellation, cleanup, project storage and export behavior remain authoritative.
- Production release certification currently remains NO-GO; a visual redesign does not change the outstanding deployment, device and quality gates.

## Brand Commitments

Reel Finisher retains its name, factual content, routes, SEO configuration, free exports without watermark, honest privacy disclosures and useful control labels. The user requests a complete public visual replacement, distinctive typography, restrained color, accessible responsive workspaces and no generic SaaS decoration.

## Evidence on Hand

Existing working interfaces, local QA fixture outputs and automated processing suites. No supplied customer testimonials, user counts, ratings or press endorsements. None may be invented. Full-page concept images are design references, not actual processing results.

## Product Principles

- Keep private files on the device during local processing.
- Put the actual task before marketing content.
- Make unsupported capabilities and optional downloads clear before starting.
- Preserve valid output, recoverability and existing Studio projects.
- Keep heavy models and editor runtimes off unrelated pages.

## Accessibility & Inclusion

Keyboard access, visible focus, semantic labels, screen-reader status, reduced motion and readable contrast. Validate desktop browser viewports at 1440, 1280, 1024, 768, 390 and 360 pixels; viewport tests are not physical-device certification.
