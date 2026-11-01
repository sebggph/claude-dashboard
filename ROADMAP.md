# Roadmap

Ideas to grow the dashboard, roughly in order of value. Each one says where it would go in the code.

## Next up

1. **Project memory files (CLAUDE.md) per project.** Today only `~/.claude/CLAUDE.md` is measured, because project folders aren't mounted. Add an optional read-only mount of your code folder (e.g. `PROJECTS_DIR`) and measure each project's `CLAUDE.md`, `.claude/rules/` and `.claude/skills/`.
   *Where:* `src/lib/server/sessions.js` → `memoryFiles()`, plus a row in `src/lib/components/ContextCard.svelte`.

2. **MCP server inventory.** Read `~/.claude.json` / `.mcp.json` (read-only) to list configured MCP servers and how many tools each adds, so the "Tools & memory" number can be split into built-in vs MCP tools.
   *Where:* new `src/lib/server/config.js`; show in `ContextCard.svelte` and a new Dashboard card.

3. **Live updates.** Replace the 15-second polling with Server-Sent Events so an open session view updates as you work.
   *Where:* a new `src/routes/api/events/+server.js` that watches file `mtime`, and an `EventSource` in `src/routes/+layout.svelte`.

4. **Cost view.** Turn token totals into estimated cost per session and per day, with a model price table you can edit.
   *Where:* the models page already lists prices (parse them in `src/lib/server/live.js`); add a card to `src/routes/sessions/[id]/+page.svelte`. Subscription users don't pay per token.

5. **Trends over time.** Context-per-day, cache hit rate per day, sessions per project. Good for teams to see habits improve.
   *Where:* a new `src/routes/trends/` page; aggregate in `src/lib/server/sessions.js`.

## Learning features

6. **"Session report card".** One score per session (lean / okay / heavy) with the top 3 fixes. Easy to share in a team chat.
7. **Interactive tutorial.** A guided tour on first launch that highlights each part of the context card.
8. **More guides.** Hooks, plan mode, permissions, headless mode in CI, writing a good skill. Files go in `static/docs/en` and `static/docs/es` plus their `index.json`.
9. **Quiz mode for the cheatsheet.** "Which command frees context without losing the summary?" Good for workshops.

## Quality & sharing

10. **Privacy mode.** Hide file paths and prompt text (shows only tool names and sizes). Useful for screenshots and demos.
11. **Export.** Download a session's breakdown as CSV / JSON, or a PDF report.
12. **Team mode.** Several people point the dashboard at a shared folder of exported transcripts. Needs auth before it's ever exposed beyond localhost.
13. **More languages.** Add a key to `src/lib/i18n.js`, the `L()` objects in `static/data/*.json`, and a `static/docs/<lang>/` folder.
14. **Publish the image** to GitHub Container Registry with a GitHub Action, so people can run it without cloning.

## Known limits

- The split of the total is **estimated** (see README). `/context` inside Claude Code is the exact source.
- Transcripts are an internal format and can change between Claude Code versions. The parser skips what it doesn't recognize, and `npm test` covers the basics.
- Claude Code deletes transcripts after 30 days by default (`cleanupPeriodDays`).
