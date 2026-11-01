# Claude Context Dashboard

Local dashboard that reads Claude Code transcripts (`~/.claude/projects/**/*.jsonl`) read-only and explains context usage. Audience: people learning Claude Code.

## Commands
- `npm run dev` (Vite, hot reload, :5173) · `npm run build` then `npm start` (:3000) or `npm run demo` · `npm run build:demo` (static online demo)
- `npm test` (parsers) · `npm run check` (i18n, guides, data, links, new docs pages) · `npm run news-snapshot` · `npm run make-demo`
- Docker: `docker compose up -d --build` → http://localhost:3000

## Stack
- SvelteKit 3 + Svelte 5 (runes) + Vite, `@sveltejs/adapter-node`. Config lives in `vite.config.js` (no svelte.config.js). Import shared code with `#lib/...`.
- Browser-only rendering (`ssr = false` in `src/routes/+layout.js`); preferences in localStorage via `src/lib/state.svelte.js`.
- Plain CSS in `src/app.css`, no CSS framework. Colors are CSS variables with light/dark values.

## Rules
- Server-only code goes in `src/lib/server/` (parser, sessions, news, live). API routes in `src/routes/api/*/+server.js` are GET-only.
- Every UI string exists in `en` and `es` (`src/lib/i18n.js`, `static/data/*.json`, `static/docs/en|es`).
- Links: use `link('/path')` and `file('/static-file')` from `#lib/paths.js` (the online demo runs under a base path).
- Never use `{@html}` on transcript text. It's only for our own markdown (`renderMarkdown`/`inline` escape input).
- Facts about Claude Code must link to official docs (https://code.claude.com/docs/en/...). Don't invent commands.
- Keep texts short and plain. Keep the grid symmetric (cards in pairs or threes).
- Parser: totals are measured; the split is estimated and calibrated. Add a test in `test/` when changing it.
- Claude facts live in `.claude/skills/update-dashboard/facts.md`. When Claude changes, run `/update-dashboard`.
- Live data (`src/lib/server/news.js`, `live.js`) only uses free official sources and must degrade gracefully (snapshots in `static/data/`).
