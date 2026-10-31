# Sources to check

All free, public and official. No API keys. Add a source here when you find a useful new one; note format changes.

| Source | URL | Good for | Used live by the app? |
|---|---|---|---|
| Claude Code changelog (docs, with dates and groups) | https://code.claude.com/docs/en/changelog.md | New/changed commands, settings, context & compaction behavior | Yes: News (every 6 h) |
| Claude Code CHANGELOG (GitHub, no dates) | https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md | Backup if the docs page is down | No |
| Claude Platform release notes | https://platform.claude.com/docs/en/release-notes/overview.md | API, models, SDK, deprecations | Yes: News (every 6 h) |
| Models overview | https://platform.claude.com/docs/en/about-claude/models/overview.md | Model IDs, context windows, max output, default effort, retirement | Yes: context window + "Current models" (daily) |
| npm registry | https://registry.npmjs.org/@anthropic-ai/claude-code/latest | Latest Claude Code version | Yes: "update available" (every 6 h) |
| Status page API | https://status.claude.com/api/v2/summary.json | Is Claude up right now | Yes: News card (every 5 min; hidden if unreachable) |
| Docs index | https://code.claude.com/docs/llms.txt | Spot new/removed docs pages (`npm run check`) | No (maintenance only) |
| Docs, full text | https://code.claude.com/docs/llms-full.txt | Search all docs at once when verifying facts | No |
| Individual docs pages | `https://code.claude.com/docs/en/<page>.md` (markdown version of each page) | Verifying a specific fact in `facts.md` | No |

## Not used (and why)

- **Models API** (`https://api.anthropic.com/v1/models`): needs an API key. The models overview page gives the same facts for free.
- **anthropic.com/news**: HTML only, no feed; mostly announcements already covered by the release notes.
- **GitHub releases API/Atom**: rate-limited / blocked in some networks; the docs changelog has the same content with dates.
