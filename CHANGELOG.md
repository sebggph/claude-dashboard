# Changelog

Content and feature updates to the dashboard. Newest first. The `/update-dashboard` skill adds an entry each time it runs.

## 2026-11-01: v0.11

- **Export** on each session: Markdown report, CSV (breakdown, timeline, tools), JSON, and a print / PDF layout. Privacy mode applies; CSV cells are protected against spreadsheet formulas.
- New Learn section **Build & automate**: *Plan before you build: plan mode*, *Automate with hooks* (tutorial), *Write your own skill* (tutorial), *Claude in scripts and CI (headless mode)*. EN + ES, 18 guides in total.

## 2026-11-01: v0.10

- **Online demo** at https://sebggph.github.io/claude-dashboard/ (sample sessions, no install). `npm run build:demo` bakes the API answers into JSON and builds a static site; a workflow publishes it to GitHub Pages on every push to main.
- All links and data paths work under a base path (`link()` / `file()` helpers in `src/lib/paths.js`).

## 2026-11-01: v0.9

- **Guided tour**: 10 short steps on first launch (Home, latest session, context card, explanations, report card, timeline, sections, settings), with a highlight, Back/Next/Skip, arrow keys and Esc. Ends on the *Start a new project* tutorial. Restart from Home (*Take the tour*) or Settings.
- Phone layout: the logo text hides on small screens so the top bar fits.

## 2026-11-01: v0.8

- **Session timeline** (Timeline tab on each session, `?view=timeline`): pick any request on the chart, with the slider or ← →; see the context size and change, your prompt, and the biggest items added (tool results, replies). Buttons jump to the biggest jumps and compactions.
- Negative numbers are shortened too (e.g. -87.8k).

## 2026-11-01: v0.7

- **Compare sessions** (`/compare`): pick A (before) and B (after); setup cost vs conversation with paired bars, key numbers, tools, and plain-language takeaways. Entry points on the sessions list and each session page.
- Demo data now records MCP tool definitions, so the demo shows MCP cost correctly.

## 2026-11-01: v0.6

- **Budget alerts**: daily, weekly (last 7 days) and per-session budgets in dollars (estimated API cost) or tokens. Budget line and red bars in the Trends chart, progress bars with status, warning banner on Home and Dashboard, *Over budget* marker in the sessions list, a session recommendation, and optional desktop notifications at 80% and 100%.

## 2026-11-01: v0.5

- **Live updates**: Server-Sent Events push changes the moment a transcript changes (green *Live* dot; falls back to 15-second checks).
- **Estimated cost** per session at official API prices (pricing page, refreshed daily), with *saved by caching*.
- **Trends** page: requests, estimated cost and cache hit rate per day (7/30/90 days) and projects.

## 2026-11-01: v0.4

- MIT license; CI on every pull request (tests, content check, build, Docker image build) plus a weekly link check.
- Session view: **Memory files** card (CLAUDE.md, rules, imports, auto memory) and **MCP servers** card (tools, definition size, failed servers); fixed overhead split into system prompt, MCP tools, memory files and built-in tools.
- **Session report card** with health grade (Lean / Okay / Heavy), top 3 fixes and *Copy for chat*; Health column in the sessions list.
- **Privacy mode** hides titles, project names, branches, file paths and prompt text.

## 2026-11-01: v0.3.1

- Docker uses the first free port from 3000 to 3010 when 3000 is taken. New `npm run docker` keeps the address stable and prints the link.

## 2026-11-01: v0.3

- Rebuilt on **SvelteKit 3 + Svelte 5 + Vite** (adapter-node), plain CSS, no CSS framework. Real page URLs (`/sessions/<id>`, `/learn/<guide>`), `npm run dev` with hot reload, two-stage Docker build.
- New **Security & guardrails** section in Learn: secure setup (tutorial), prompt injection, code quality & security reviews, guardrails and monitoring agents.
- Cheatsheet: new "Security & code quality" section.

## 2026-10-31: v0.2

Covers Claude Code up to **v2.1.316** and Platform notes up to 2026-10-30.

- Home screen with links to every section, latest session snapshot and context news.
- News page: Claude Code changelog and Platform release notes, refreshed every 6 hours, with context-related items highlighted.
- Live facts: current models (context window, max output, default effort), latest Claude Code version, service status.
- Learn hub with sections, reading time, levels, read tracking and tickable tutorial steps.
- New guides: compaction; change mid-session or start fresh; tutorials for new and existing projects.
- `/update-dashboard` project skill, facts registry and `npm run check`.

## 2026-10-31: v0.1

- First version: sessions, `/context`-style breakdown, recommendations, guides, cheatsheet, EN/ES, light/dark, Docker.
