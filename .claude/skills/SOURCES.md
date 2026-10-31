# Vendored skills

Text-only copies of third-party Claude Code skills. No hooks, scripts or plugins were installed.
Re-inspect upstream before updating.

| Skill | Source | Commit | License | Notes |
| --- | --- | --- | --- | --- |
| karpathy-guidelines | github.com/multica-ai/andrej-karpathy-skills | 2c60614 | MIT (declared in SKILL.md and plugin.json) | Verbatim |
| ponytail | github.com/DietrichGebert/ponytail (v5.3.2) | 09c434a | MIT (LICENSE) | Only `skills/ponytail/SKILL.md`. The plugin's hooks (SessionStart/UserPromptSubmit scripts, cost ledger in ~/.config, optional webhook) were deliberately not installed. Without hooks it is model-invoked, not always on. |
| frontend-design | github.com/anthropics/skills | dbd4588 | Apache-2.0 (LICENSE.txt) | Verbatim. Project brief wins on conflicts (CLAUDE.md, user instructions). |
| find-skills | github.com/vercel-labs/skills (`skills/find-skills/SKILL.md`) | content hash `b146008…` in `skills-lock.json` (installed 2026-11-01) | MIT (repository license) | Installed by the user's request with `npx skills add … --skill find-skills -a claude-code --copy`. Text only. It suggests running `npx skills find/add`, which downloads third-party skills: review any skill before installing it. |

Considered and not installed:
- `anthropics/skills/webapp-testing`: Python Playwright helpers, which tell the agent to run scripts unread. We already have Node Playwright (`tests/e2e`).
- `ponytail-review` / `ponytail-audit`: overlap with the built-in `/code-review`, `/security-review` and `/simplify`.
- Context7 MCP: context7.com is blocked by this cloud environment's network policy. Use the version-matched docs in `node_modules` instead (`next/dist/docs`, `mediabunny/dist/mediabunny.d.ts`), plus official sites.
