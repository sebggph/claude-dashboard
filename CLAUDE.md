# Claude Context Dashboard

Local dashboard that reads Claude Code transcripts (`~/.claude/projects/**/*.jsonl`) read-only and explains context usage. Audience: people learning Claude Code.

## Commands
- `npm start` (reads `~/.claude`), `npm run demo` (sample data), `npm test`, `npm run check` (content/links), `npm run news-snapshot`, `npm run make-demo`
- Docker: `docker compose up -d --build` → http://localhost:3000

## Rules
- No runtime dependencies and no build step. Node stdlib server, vanilla ES modules in `public/js/`.
- Every UI string exists in both `en` and `es` (`public/js/i18n.js`, `public/data/*.json`, `docs/en|es`).
- Escape anything that comes from a transcript with `esc()` before putting it in HTML.
- Facts about Claude Code must link to official docs (https://code.claude.com/docs/en/...). Don't invent commands.
- Keep texts short and plain. Keep the grid symmetric (cards in pairs).
- Parser logic: `server/parser.js`. Totals are measured; the split is estimated and calibrated. Add a test in `test/` when changing it.
- Claude facts live in `.claude/skills/update-dashboard/facts.md`. When Claude changes, run `/update-dashboard` (it updates code, content and its own facts/sources).
- Live data (`server/news.js`, `server/live.js`) only uses free official sources and must degrade gracefully (snapshot in `public/data/`).
