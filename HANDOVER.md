# Handover

State of the project at the end of the first build session (2026-11-01, v0.12). Read this, `CLAUDE.md`, `README.md` and `ROADMAP.md` before starting new work.

## What it is

Claude Context Dashboard: a local, read-only dashboard for Claude Code sessions (context use, what fills it, cost, habits) plus learning material, in English and Spanish, light and dark.

- Repo: https://github.com/sebggph/claude-dashboard (public, MIT)
- Online demo (sample data): https://sebggph.github.io/claude-dashboard/
- Docker image: `ghcr.io/sebggph/claude-dashboard:latest` (published on every merge to `main`)

## What's built

| Area | Where |
|---|---|
| Usage per agent (main, subagents, workflow agents; idle cache rebuilds, >400K requests) | `src/lib/server/usage.js`, `src/lib/usage.js`, `src/routes/usage`, `FixPanel.svelte` |
| Transcript parser (measured totals, calibrated split, MCP, steps, per-model/day usage) | `src/lib/server/parser.js` |
| Session discovery, memory files (CLAUDE.md, rules, imports, auto memory) | `src/lib/server/sessions.js`, `memory.js` |
| News, live facts (models, prices, latest version, status) | `src/lib/server/news.js`, `live.js` |
| Live updates (SSE) | `src/lib/server/watch.js`, `src/routes/api/events` |
| Context rules, recommendations, health grade, privacy masking | `src/lib/rules.js` |
| Cost, budgets, compare, export, quiz | `src/lib/cost.js`, `budget.js`, `compare.js`, `export.js`, `quiz.js` |
| Pages | `src/routes/` (home, dashboard, sessions, session detail + timeline, compare, trends, learn, cheatsheet + quiz, news) |
| Components | `src/lib/components/` |
| Guides (18, EN + ES), cheatsheet (72 items), context explanations | `static/docs/`, `static/data/` |
| Base-path helpers for the static demo | `src/lib/paths.js` (`link()`, `file()`) |
| Self-update skill + facts registry | `.claude/skills/update-dashboard/` |

Tests: `npm test` (22). Content check: `npm run check` (`-- --offline` without network).

## Automation

- **CI** (`.github/workflows/ci.yml`): tests, offline content check, build, Docker build on every PR; link check weekly.
- **Publish image** (`publish.yml`) and **Online demo** (`pages.yml`): on every push to `main`.
- **Weekly routine** "Weekly dashboard update (claude-dashboard)": Mondays 18:43 UTC, runs `/update-dashboard` in a fresh cloud session and opens a PR (never merges). Manage or pause it under Routines on claude.ai.

## Open items

- **To do:** Team mode (see `ROADMAP.md`). Needs sign-in and a security review before it's exposed beyond localhost.
- **On hold:** more languages.
- Owner settings to consider: GitHub *Settings → General → Automatically delete head branches*; make the ghcr.io package public.
- Not verified from the dev sandbox (network blocked): the status-page card, and the demo page in a browser.

## Working in the Claude Code cloud sandbox

- Merging PRs, deleting branches and changing repo settings need the owner: merges need an explicit "merge #N" each time; branch deletion and settings changes are blocked by the sandbox network.
- Use the GitHub REST API (`gh api ...`); GraphQL (`gh pr create`) is not available.
- Live fetches from Node need `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` (e.g. `npm run news-snapshot`).
- `svelte.dev`, `github.io` and `status.claude.com` are not reachable; SvelteKit 3 details were taken from the installed packages.
- Docker in the sandbox: start `dockerd` yourself; Docker Hub may rate-limit and containers can't reach npm, so CI is the place where the full image build is verified.
- Long sessions fill the context window: start a fresh session per roadmap item.
