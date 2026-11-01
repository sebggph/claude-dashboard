# Roadmap

Ideas to grow the dashboard, roughly in order of value. Each one says where it would go in the code.

## Next up

1. **Quiz mode for the cheatsheet.** "Which command frees context without losing the summary?" Good for workshops.
2. **More languages.** Add a key to `src/lib/i18n.js`, the `L()` objects in `static/data/*.json`, and a `static/docs/<lang>/` folder.

## Learning features


## Quality & sharing

9. **Team mode.** Several people point the dashboard at a shared folder of exported transcripts. Needs auth before it's ever exposed beyond localhost.

## Done

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
