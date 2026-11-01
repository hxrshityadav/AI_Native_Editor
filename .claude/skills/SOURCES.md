# Vendored skills

Text-only copies of third-party Claude Code skills. No hooks, scripts or plugins were installed.
Re-inspect upstream before updating.

| Skill | Source | Commit | License | Notes |
| --- | --- | --- | --- | --- |
| karpathy-guidelines | github.com/multica-ai/andrej-karpathy-skills | 2c60614 | MIT (declared in SKILL.md and plugin.json) | Verbatim |
| ponytail | github.com/DietrichGebert/ponytail (v5.3.2) | 09c434a | MIT (LICENSE) | Only `skills/ponytail/SKILL.md`. The plugin's hooks (SessionStart/UserPromptSubmit scripts, cost ledger in ~/.config, optional webhook) were deliberately not installed. Without hooks it is model-invoked, not always on. |
| frontend-design | github.com/anthropics/skills | dbd4588 | Apache-2.0 (LICENSE.txt) | Verbatim. Project brief wins on conflicts (CLAUDE.md, user instructions). |
| find-skills | github.com/vercel-labs/skills (`skills/find-skills/SKILL.md`) | content hash `b146008…` in `skills-lock.json` (installed 2026-11-01) | MIT (repository license) | Installed by the user's request with `npx skills add … --skill find-skills -a claude-code --copy`. Text only. It suggests running `npx skills find/add`, which downloads third-party skills: review any skill before installing it. |

| web-design-guidelines | github.com/vercel-labs/agent-skills (`skills/web-design-guidelines`) | hash in `skills-lock.json` (installed 2026-11-01, via find-skills) | MIT (repository license) | Text only. At review time it fetches the current rules from `raw.githubusercontent.com/vercel-labs/web-interface-guidelines`. Used for UI and accessibility reviews. |
| vercel-react-best-practices | github.com/vercel-labs/agent-skills (`skills/react-best-practices`) | hash in `skills-lock.json` (installed 2026-11-01, via find-skills) | MIT (declared in SKILL.md) | Text only: SKILL.md, AGENTS.md and 72 rule files. Bundle-size and re-render rules for React/Next.js. Next.js API details still come from `node_modules/next/dist/docs`. |

| impeccable | github.com/pbakaus/impeccable | hash in `skills-lock.json` (installed 2026-11-01 at the user's request) | see upstream repository | Design, redesign and audit guidance plus `reference/` docs. Ships `scripts/impeccable`, a launcher that downloads an engine binary from the project's GitHub releases and verifies it against `engine-checksums.txt`, and browser-injection scripts. Tell the user before running the launcher or scripts; the reference docs are usable as text. |
| design-taste-frontend | github.com/leonxlnx/taste-skill | hash in `skills-lock.json` (installed 2026-11-01 at the user's request) | see upstream repository | Art-direction rules. Ships Node scripts (`scripts/*.mjs`) that drive Chrome over DevTools, some of which fetch remote assets. Installer rated it Medium Risk (1 alert). Use the rules as text; review a script before running it. |
| ui-ux-pro-max | github.com/nextlevelbuilder/ui-ux-pro-max-skill | hash in `skills-lock.json` (installed 2026-11-01 at the user's request) | see upstream repository | UI/UX catalog (CSV data) with Python search scripts that run offline. The other skills in that repo (slides, banner, brand) were not installed. |

Considered and not installed: taste-skill's `redesign-existing-projects` and `high-end-visual-design` appeared in search results but are not in the repository's current skill list.
- `anthropics/skills/webapp-testing`: Python Playwright helpers, which tell the agent to run scripts unread. We already have Node Playwright (`tests/e2e`).
- `ponytail-review` / `ponytail-audit`: overlap with the built-in `/code-review`, `/security-review` and `/simplify`.
- Context7 MCP: context7.com is blocked by this cloud environment's network policy. Use the version-matched docs in `node_modules` instead (`next/dist/docs`, `mediabunny/dist/mediabunny.d.ts`), plus official sites.
