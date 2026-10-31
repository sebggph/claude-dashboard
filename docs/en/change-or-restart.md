# Change mid-session or start fresh?

> Some changes are free mid-session, some make the next turn slow and costly, and some only apply after `/clear`.

## Why it matters

Every message re-sends the whole conversation. **Prompt caching** lets the API reuse the part that didn't change, so it's read faster and billed at a lower rate. The match starts from the top and must be exact: if something early changes, like the model or the tool list, everything after it is processed again. That **cache miss** makes the next turn slower and more expensive. After that, the new version is cached.

The cache also expires when you stop. On a Claude subscription the main conversation keeps it for about **one hour**. With an API key, usage credits or a cloud provider it lasts **five minutes**. Subagents get five minutes either way.

Some changes are cache-safe because they don't reach the running session at all. CLAUDE.md edits, for example, wait for `/clear`, `/compact` or a restart.

## Quick decision table

| Change | What happens | Breaks cache? | Best practice |
| --- | --- | --- | --- |
| `/model` | Each model has its own cache | Yes | Pick at the start |
| `/effort` | New level from your next message | Kept on Opus, Sonnet, Haiku 5.5 and Fable 5.1 (API key or subscription). Yes on most others | Set at the start |
| `/fast` | Separate cache. First enable bills the conversation at fast rates | Yes | Turn on at the start |
| `ultrathink` in a prompt | Deeper reasoning for that turn only | Not documented | Use instead of changing `/effort` for one question |
| MCP server on or off (`/mcp`) | With tool search (default) the tool list stays fixed. Config edits wait for a restart | Kept with tool search. Yes without it | Connect before you start |
| Install or enable a plugin or skill | Skills, commands, agents and hooks are appended | Kept, unless it adds MCP servers | Go ahead |
| Edit CLAUDE.md | Not applied to the running session | Kept | `/clear` to load it |
| Permission mode, `Shift+Tab`, plan mode | Applies right away | Kept, except with `opusplan` | Change freely |
| `/add-dir` | File access now. Most `.claude/` config isn't loaded from it | Not documented | Add when needed |
| Output style | Applies from your next message | Kept | Change freely |
| `/config` settings | Most reload live. `model` and effort are read at start | Depends on the setting | Use `/model` and `/effort` for those |
| Switch git branch | Changed files get a notice. Branch info is a startup snapshot | Kept | New task there: `/clear` |
| Unrelated task | Old history is re-sent every turn | No, but you pay for it | `/clear` |
| Back after a long break | Cache expired | Yes | `/clear` if you don't need the history |
| `/autocompact` window | Saved and applied to this session | Not documented | Set once |

## The important ones

### Model

`/model` switches and saves your default. Press `s` in the picker to switch for this session only.

- **Impact:** the next request re-reads the whole history uncached. While the cache is warm, Claude Code asks you to confirm.
- **Pros:** the right model for the job. **Cons:** one slow, full-price turn, worse on long sessions.
- **Recommendation:** choose at the start. For a side job on another model, use a subagent (it can set `model: haiku`); the parent's cache is unaffected. For two models at once, open a second terminal with its own `--model`.

### Effort

Sets how hard Claude thinks, from `low` to `max`.

- **Impact:** cache kept on the models in the table. On Bedrock, Google Cloud, gateways and other models, it's a full re-read.
- **Recommendation:** start at the default `medium`. For one tricky question, add `ultrathink` to that prompt.

### Fast mode

Same Opus, up to 2.5x faster, higher price per token. On a subscription it uses usage credits.

- **Impact:** the first enable bills everything so far uncached at fast rates. Each later toggle re-reads again.
- **Recommendation:** decide at the start. It stays on across sessions by default.

### MCP servers

- **Impact:** with tool search (default on supported models), mid-session changes don't disturb the cache. Without it, connecting or disabling a server invalidates it. MCP config edits do nothing until you restart.
- **Recommendation:** connect what you need before your first message.

### CLAUDE.md

- **Impact:** read once at start. A mid-session edit keeps the cache, but Claude uses the old version.
- **Recommendation:** edit, then `/clear` at a natural break. See [CLAUDE.md and memory](#/guides/03-claude-md-memory.md).

### Permission and plan mode

- **Impact:** cache-safe. Plan mode's instructions arrive as messages. The exception is `opusplan`, which swaps Opus and Sonnet as you enter and leave plan mode.
- **Recommendation:** switch whenever it helps.

### New task

- **Impact:** a session with three unrelated tasks re-reads all three on every turn of the fourth.
- **Recommendation:** `/clear`, which is free. Name what you leave: `/clear oauth-migration`.

### Long break

- **Impact:** the first turn back re-reads everything. `/compact` costs the most now, because its summary can't use the cache. On the one-hour cache, an idle session past about 200K tokens is compacted before the cache expires.
- **Recommendation:** if you don't need the history, `/clear`.

## Rules of thumb

- Pick model, effort and fast mode at the top of the session.
- Set up MCP servers first. Restart after editing their config.
- `/clear` between unrelated tasks, and after two failed corrections.
- One hard question: `ultrathink`. Quick question about the session: `/btw`, which stays out of the history.
- Other-model work: a subagent or a second terminal, not `/model`.
- To abandon a path, `/rewind`: it goes back to an already cached point. To try another direction and keep this one, `/branch`.
- `/compact` at natural breaks while the cache is warm.

## How to see it in the dashboard

- **Model changed mid-session**: one session used more than one model.
- **Cache expired after a break**: a long gap followed by a big cache write.
- **Cache hit rate** tile: share of input read from cache. Higher is better.
- **Context growth** chart: hover a point. A big **New (cache write)** value on a normal turn marks a cache miss.

More in [Reading this dashboard](#/guides/06-reading-the-dashboard.md) and [Compaction explained](#/guides/compaction.md).

## Quick tips

- `/usage` shows your cache hit rate and the likely cause of the last miss.
- `/recap` summarizes the session without touching the cache.
- Write a big plan to a spec file, then build it in a fresh session.

## Learn more

- [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching)
- [Model configuration](https://code.claude.com/docs/en/model-config)
- [Fast mode](https://code.claude.com/docs/en/fast-mode)
- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Settings](https://code.claude.com/docs/en/settings)
- [Interactive mode](https://code.claude.com/docs/en/interactive-mode)
- [Commands](https://code.claude.com/docs/en/commands)
- [Best practices](https://code.claude.com/docs/en/best-practices)
