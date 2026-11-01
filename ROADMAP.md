# Roadmap

Ideas to grow the dashboard, roughly in order of value. Each one says where it would go in the code.

## Next up

1. **Live updates.** Replace the 15-second polling with Server-Sent Events so an open session view updates as you work.
   *Where:* a new `src/routes/api/events/+server.js` that watches file `mtime`, and an `EventSource` in `src/routes/+layout.svelte`.

2. **Cost view.** Turn token totals into estimated cost per session and per day, with a model price table you can edit.
   *Where:* the models page already lists prices (parse them in `src/lib/server/live.js`); add a card to `src/routes/sessions/[id]/+page.svelte`. Subscription users don't pay per token.

3. **Trends over time.** Context-per-day, cache hit rate per day, sessions per project. Good for teams to see habits improve.
   *Where:* a new `src/routes/trends/` page; aggregate in `src/lib/server/sessions.js`.

## Learning features

4. **Interactive tutorial.** A guided tour on first launch that highlights each part of the context card.
5. **More guides.** Hooks, plan mode, permissions, headless mode in CI, writing a good skill. Files go in `static/docs/en` and `static/docs/es` plus their `index.json`.
6. **Quiz mode for the cheatsheet.** "Which command frees context without losing the summary?" Good for workshops.
7. **Online demo page.** A static build with the sample sessions, so people can try it in the browser without installing anything.

## Quality & sharing

8. **Export.** Download a session's breakdown as CSV / JSON, or a PDF report.
9. **Team mode.** Several people point the dashboard at a shared folder of exported transcripts. Needs auth before it's ever exposed beyond localhost.
10. **More languages.** Add a key to `src/lib/i18n.js`, the `L()` objects in `static/data/*.json`, and a `static/docs/<lang>/` folder.

## Done

- Project memory files and MCP servers per session (v0.4)
- Session report card and privacy mode (v0.4)
- License (MIT) and CI checks (v0.4)
- Docker image published to GitHub Container Registry (v0.4)

## Known limits

- The split of the total is **estimated** (see README). `/context` inside Claude Code is the exact source.
- Transcripts are an internal format and can change between Claude Code versions. The parser skips what it doesn't recognize, and `npm test` covers the basics.
- Claude Code deletes transcripts after 30 days by default (`cleanupPeriodDays`).
