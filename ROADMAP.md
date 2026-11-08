# Roadmap

Ideas to grow the dashboard, roughly in order of value. Each one says where it would go in the code.

## To do

1. **Team mode.** Several people point the dashboard at a shared folder of exported transcripts, for workshops and teams. Needs sign-in and a security review before it's ever exposed beyond localhost.
   *Where:* a team data source next to `src/lib/server/sessions.js`, auth in `src/hooks.server.js`, a team overview page.

## On hold

- **More languages.** Add a key to `src/lib/i18n.js`, the `L()` objects in `static/data/*.json`, and a `static/docs/<lang>/` folder.

## Done

- Live agents monitor, weekly plan forecast (status line logger or typed in), cost per workflow run, weekly report, session cost and budgets include agents (v0.14)
- Usage page: what uses your tokens (subagents, workflows, idle cache rebuilds) with *Fix with Claude* prompts; subagent usage counted in Trends and budgets; very large transcripts (>512 MB) read in chunks (v0.13)
- Cheatsheet quiz mode (v0.12)
- Session export: Markdown report, CSV, JSON, print/PDF (v0.11)
- Guides: plan mode, hooks, write a skill, headless/CI (v0.11)
- Online demo on GitHub Pages (v0.10)
- Guided first-launch tour (v0.9)
- Session timeline: request-by-request view with biggest jumps and compactions (v0.8)
- Compare two sessions side by side with takeaways (v0.7)
- Budget alerts: daily / weekly / per-session, dollars or tokens, notifications (v0.6)
- Live updates via Server-Sent Events (v0.5)
- Estimated cost at API prices and Trends page (v0.5)
- Project memory files and MCP servers per session (v0.4)
- Session report card and privacy mode (v0.4)
- License (MIT) and CI checks (v0.4)
- Docker image published to GitHub Container Registry (v0.4)

## Known limits

- The split of the total is **estimated** (see README). `/context` inside Claude Code is the exact source.
- Transcripts are an internal format and can change between Claude Code versions. The parser skips what it doesn't recognize, and `npm test` covers the basics.
- Claude Code deletes transcripts after 30 days by default (`cleanupPeriodDays`).
