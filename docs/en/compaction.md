# Compaction: what it is and how to use it

> Compaction swaps your long conversation for a summary so the session can keep going. Here's what it keeps, what it loses, and when to do it yourself.

## What compaction is

As a session grows, the context window fills up (see [What is the context window?](#/guides/01-what-is-context.md)). **Compaction** replaces the message history with a structured summary. The summary keeps your requests and key code snippets, so you keep working in the same session with much less in context.

There are two kinds:

- **Auto-compaction**: Claude Code does it on its own as you approach the limit, so a full window doesn't end your session.
- **Manual**: you run `/compact`, optionally with focus instructions, like `/compact focus on the auth bug fix`.

## When auto-compaction runs

If you haven't changed anything, the trigger point depends on your model:

- Models with a native 1M window (Fable models, Sonnet 5 and later, Haiku 5.5, Opus 4.7 and later) compact at about **967K tokens**.
- Sonnet 4.6 and Opus 4.6 without the `[1m]` extended context compact at the **200K** boundary.
- Cloud sessions compact as the conversation approaches the model's limit.

You can move the trigger point:

- `/autocompact 500k` saves a window for the current model. `/autocompact auto` goes back to the default.
- `claude --autocompact 300k` applies to one launch only.
- `"autoCompactWindow": 200000` in `settings.json` applies to every model.
- The `CLAUDE_CODE_AUTO_COMPACT_WINDOW` environment variable overrides all of the above (useful in scripts).

Values go from 100K to 1M tokens. To turn auto-compaction off, toggle **Auto-compact** in `/config`.

**Idle compaction.** If a session over about 200K tokens sits idle for about an hour on the one-hour prompt cache, Claude Code may compact it just before the cache expires. You'll see a notice starting with `Compacted while idle`. Turn it off with `"idleCompaction": false` or the **Idle compaction** row in `/config`.

Separately, Claude Code can also clear old tool results from context on its own. That is not a full compaction.

## What survives and what gets lost

Reloaded or kept after compaction:

- Project-root `CLAUDE.md`, unscoped rules and auto memory, re-read from disk.
- Skill descriptions, plus the bodies of skills you used (capped at 5,000 tokens each, 25,000 total; oldest dropped first).
- Up to **five** recently modified files Claude read or edited. A file over 5,000 tokens comes back as a path only.
- The plan written in plan mode, and running background commands and subagents.

Only a summary remains of:

- Exact error messages and long command output.
- Earlier decisions and the reasons behind them ("we tried X, it broke Y").
- File contents read long ago.
- The nuance of instructions you typed in chat, such as "never touch the migrations folder".
- Nested `CLAUDE.md` files and path-scoped rules. They reload when Claude touches a matching file again.

## Impact on your session

- **Drift**: if a rule lived only in chat, Claude may stop following it.
- **Re-reading**: Claude may need to open files again, which adds tokens back.
- **Cost and cache**: the summary is a separate request that reads the whole conversation. With a warm cache that's fairly cheap. After a long break, the cache is gone and it costs much more. Compaction also resets the conversation cache, so the next turn rebuilds it (but only for the short summary).
- **The compaction loop**: in very long sessions, or when one huge file or output refills context right away, you compact again and again and lose more detail each time. Claude Code stops auto-compacting after a few failed attempts and shows an error instead.

## Pros and cons

| Pros | Cons |
|---|---|
| You keep going without starting over | Details and nuance get lost in the summary |
| Frees a lot of context in one step | The summary request can be expensive on a cold cache |
| Focus instructions let you choose what to keep | Chat-only rules can stop being followed |
| CLAUDE.md and memory reload automatically | Repeated compactions blur the history more each time |

## Compact, clear, new session, rewind or subagent?

| Situation | Best move | Why |
|---|---|---|
| Same task, long history, need continuity | `/compact <focus>` | Keeps what matters, frees space |
| Switching to unrelated work | `/clear` | Free, and old history only adds noise |
| Task done, or the session got confused | New session (or `/clear`) | A clean start beats a blurry summary |
| Last few turns went down a wrong path | `/rewind` | Truncates back to a prefix already cached |
| Only part of the chat is noise | `/rewind` + **Summarize from here** | A targeted compaction |
| Big search, logs or many file reads ahead | Subagent | The reads stay in its own window |

For more on this choice, see [Change mid-session or start fresh?](#/guides/change-or-restart.md).

## How to compact well

**Pick the moment.** Compact at a natural break: after a feature is done, before a new phase. Waiting for auto-compaction means it may hit in the middle of a delicate step.

**Tell it what to keep.** Be specific:

```
/compact keep the final API design, the failing test name and the exact error message
```

```
/compact focus on the decisions we made about the database schema and why; drop the exploration
```

```
/compact keep the list of files changed so far and the remaining TODO steps
```

**Make rules durable.** Anything that must hold for the whole project belongs in `CLAUDE.md` (see [CLAUDE.md and memory](#/guides/03-claude-md-memory.md)). You can also add a "Compact Instructions" section there to guide every summary:

```
# Compact instructions
When compacting, focus on test output and code changes.
```

Note: edits to `CLAUDE.md` mid-session only apply after `/clear`, `/compact` or a restart.

## Spotting compaction in this dashboard

- **Context growth chart**: **Compaction** markers show where the history was summarized and the context size dropped.
- **Sessions list**: the **Compactions** column counts them per session.
- **Context card**: a **Compaction summary** row shows how much space the summary itself takes.
- **Recommendations**: **Compacting often** appears when a session compacted two or more times. That's a sign to split work into smaller sessions.

See [Reading the dashboard](#/guides/06-reading-the-dashboard.md) for the rest of the screen.

## Quick tips

- Compact at natural breaks, not mid-task.
- Always add a focus: `/compact keep ...`.
- If you don't need continuity, `/clear` is cheaper than `/compact`.
- Compact before stepping away, while the cache is still warm.
- Move rules from chat into `CLAUDE.md` so they survive.
- Several compactions in one session? Start fresh.

## Learn more

- [Explore the context window: what survives compaction](https://code.claude.com/docs/en/context-window)
- [Set the auto-compact window](https://code.claude.com/docs/en/model-config)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
- [Checkpointing](https://code.claude.com/docs/en/checkpointing)
- [Settings reference](https://code.claude.com/docs/en/settings-reference)
