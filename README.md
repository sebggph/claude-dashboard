# Claude Context Dashboard

**English** · [Español](README.es.md)

A small, friendly dashboard that shows **how much context your Claude Code sessions use, what fills it, and how to keep it lean**. Built to help people learn to use Claude in an optimized way.

- **Sessions overview**: every local Claude Code session, how full its context is, and when it was last active.
- **Context breakdown**: a detailed list like `/context`: system prompt, tools, skills, MCP, your messages, Claude's replies, thinking, tool calls and tool results, plus autocompact buffer and free space.
- **Explanations with proof**: click any row to see what it is, how to reduce it, and links to the official Claude Code docs.
- **Recommendations**: simple rules spot big tool outputs, frequent compaction, low cache hits and more.
- **Charts**: context growth per request with compaction markers, biggest items, tools used, subagents, token totals.
- **Learn hub**: step-by-step tutorials (*Start a new project*, *Optimize an existing project*) with tickable checklists, plus guides on context, compaction, CLAUDE.md, MCP/skills/subagents, workflows and *Change mid-session or start fresh?*. Tracks what you've read.
- **Printable cheatsheet**: 50+ commands and shortcuts with short "why it helps" notes.
- **Light & dark mode**, **English & Spanish**, works on Mac, Windows and Linux.

Runs only on your computer. Your transcripts are mounted **read-only** and never leave your machine.

## Quick start (Docker)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac or Windows) or Docker Engine (Linux).

```bash
git clone https://github.com/sebggph/claude-dashboard.git
cd claude-dashboard
docker compose up -d --build
```

Open **http://localhost:3000**. If port 3000 is already in use, Docker picks the next free port up to 3010. To see which one:

```bash
docker compose port dashboard 3000
```

**Tip:** if you have Node.js, run `npm run docker` instead. It uses 3000 when it's free (or the next free port), keeps the same address across restarts, and prints the link to open.

It reads `~/.claude` on Mac/Linux and `%USERPROFILE%\.claude` on Windows automatically. To use another folder, copy `.env.example` to `.env` and set `CLAUDE_HOME`.

Stop it with `docker compose down`.

### Without Docker (Mac or PC)

Needs [Node.js](https://nodejs.org/) 22 or newer. Built with [SvelteKit](https://svelte.dev/docs/kit) and Vite; no CSS framework.

```bash
npm install
npm run dev        # development with hot reload → http://localhost:5173
```

To run it like in production:

```bash
npm run build
npm start          # reads ~/.claude → http://localhost:3000
npm run demo       # sample data only
```

Other settings (`CLAUDE_DIR`, `PORT`, `NEWS=off`) are environment variables, e.g. `CLAUDE_DIR=/path/to/.claude npm start`.

## Where the data comes from

Claude Code saves every session as a `.jsonl` file under `~/.claude/projects/`. Each Claude reply records the real token usage reported by the API. The dashboard uses that to show:

| Number | How it's calculated | Accuracy |
|---|---|---|
| Context used | `input + cache write + cache read` of the latest request (same formula as Claude Code's status line) | Measured |
| Claude's replies & thinking | `output_tokens` per reply | Measured |
| Your messages, tool results, listings | Text length, calibrated per session from how much context grew between requests | Estimated |
| System prompt, tools & memory | Whatever is left: total minus all messages | Estimated |
| Window size | From the model name, per the [official docs](https://code.claude.com/docs/en/model-config) (change it in ⚙ Settings) | Rule-based |

For exact numbers inside a session, run `/context` in Claude Code.

**Which sessions show up?** Sessions that ran on this computer: the CLI, the desktop app and IDE extensions. Cloud sessions (claude.ai/code) run on Anthropic's servers, so their transcripts are not on your disk.

## News and live facts

The **News** page shows the official Claude Code changelog and Claude Platform release notes, refreshed every 6 hours, with context-related changes highlighted. The dashboard also reads a few free, official sources to stay accurate:

| Source | Used for | Refresh |
|---|---|---|
| Claude Code changelog & Platform release notes | News page, "What's new" on Home | 6 h |
| Models overview (docs) | Correct context window per model, "Current models" card | daily |
| npm registry | "Update available" when a session ran on an older Claude Code | 6 h |
| Status page | Service status on the News page (hidden if unreachable) | 5 min |

These are the only requests to the internet, and they send nothing about you. Set `NEWS=off` in `.env` to turn them all off; the app then uses the copy bundled in `static/data/`.

## Keeping it up to date

This repo includes a Claude Code skill, **`/update-dashboard`** (`.claude/skills/update-dashboard/`). Run it in Claude Code inside this project after a Claude release. It checks the official sources, updates facts, guides, cheatsheet and code in both languages, runs `npm test` and `npm run check`, and then updates its own facts list (`facts.md`) and sources (`sources.md`).

## Project memory files (optional)

The session view lists the memory files Claude Code loads: your `~/.claude/CLAUDE.md`, auto memory, and the project's `CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/` and `@imports`, with lines, tokens and whether they load at start.

- **Without Docker** this works automatically.
- **With Docker**, the container can't see your code folders until you mount them (read-only): set `PROJECTS_HOME=/path/to/your/code` in `.env` and uncomment the `/data/projects` line in `docker-compose.yml`.

MCP servers need no setup: the dashboard reads them from the session itself.

## Troubleshooting

- **"Demo mode" banner, but I do use Claude Code.** Check that `CLAUDE_HOME` points to the folder that contains `projects/`.
- **Linux: "folder can't be read".** The container runs as an unprivileged user. Add `UID_GID=1000:1000` (your `id -u`:`id -g`) to `.env` and run `docker compose up -d` again.
- **Windows with WSL.** If Claude Code runs inside WSL, set `CLAUDE_HOME=//wsl$/Ubuntu/home/<you>/.claude`.
- **Port 3000 is taken.** It's handled automatically (see Quick start). To always use one port, set e.g. `PORT=8080` in `.env`. `npm run dev` also moves to the next free port on its own.

## Project layout

```
src/routes/            Pages (/, /dashboard, /sessions, /learn, /cheatsheet, /news) and API (/api/*)
src/lib/components/    Svelte components (context card, growth chart, drawer, …)
src/lib/server/        Transcript parser, session discovery, news and live facts (server only)
src/lib/               Shared logic: rules.js (context rules), i18n.js, state.svelte.js, markdown.js
src/app.css            All styles (plain CSS, light + dark themes)
static/docs/en|es/     Markdown guides & tutorials (+ index.json)
static/data/           Cheatsheet, context explanations, news/models snapshots
samples/               Demo sessions (regenerate: npm run make-demo)
test/                  Parser tests (npm test)
.claude/skills/        The /update-dashboard skill and its facts list
```

## Adding a guide or tutorial

1. Write `static/docs/en/<name>.md` and `static/docs/es/<name>.md` (same structure in both).
2. Add an entry to both `static/docs/en/index.json` and `static/docs/es/index.json`:
   `{"file": "<name>.md", "title": "…", "summary": "…", "icon": "book", "section": "start|concepts|habits|security", "type": "tutorial|guide", "minutes": 6, "level": "beginner|intermediate"}`
3. Supported markdown: headings, lists, tables, code, quotes, links. `- [ ] step` becomes a checkbox the app remembers. Link other guides with `[title](/learn/<name>)`.
4. Run `npm run check`.

## Contributing

See [ROADMAP.md](ROADMAP.md) for ideas and where each one would go in the code. Keep texts short and plain, add both languages, and link claims to the official docs.

## License

[MIT](LICENSE): free to use, change and share, including commercially. Keep the copyright notice.
