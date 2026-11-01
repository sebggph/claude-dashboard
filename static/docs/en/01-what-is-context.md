# What is the context window?

> The context window is Claude's working memory for one session: everything it can "see" right now, measured in tokens.

## A simple analogy

Picture a desk. Everything Claude needs for your task has to fit on that desk: its instructions, your project notes, the files it opened, and the whole conversation so far. The desk has a fixed size. When it gets crowded, older papers get squeezed into a short summary so there is room for new ones.

That desk is the **context window**. Its size is measured in **tokens** (small pieces of text). Depending on the model, the window can be as large as 1 million tokens.

## What fills it

Some things load before you type anything:

- **System prompt**: Claude Code's core instructions.
- **Tools**: the definitions of built-in tools like reading files or running commands.
- **MCP tools**: for connected MCP servers, only tool names and server instructions load at first. Full tool schemas load when Claude needs a specific tool.
- **Skills**: the short description of each skill. The full skill loads only when it is used.
- **Memory**: your `CLAUDE.md` files and auto memory.

Then, as you work, more gets added:

- **Your messages** and **Claude's replies**.
- **Tool calls and tool results**: every file Claude reads and every command output lands in context. These are often the biggest items.

## Why it matters

Every request sends the whole conversation again. So a bigger context means:

- More tokens used on every turn, even with prompt caching.
- More noise. Old, unrelated content can distract Claude from what matters now.

## Autocompact

You won't usually hit a wall. When the conversation gets close to the limit, Claude Code **compacts automatically**: it replaces older history with a structured summary. The summary keeps your requests and key code snippets, but detailed instructions from early in the chat can be lost. That's why lasting rules belong in `CLAUDE.md`, which is re-loaded from disk after compaction.

The exact point where auto-compaction runs depends on your model and settings. You can change it with `/autocompact`.

## Check your own session

Run this inside Claude Code at any time:

```
/context
```

It shows a live breakdown of what is using space, by category, with optimization suggestions. It also lists which `CLAUDE.md` and auto memory files loaded. Use `/context all` to expand the per-item breakdown.

## Quick tips

- Run `/context` when a session feels slow or "forgetful".
- Large file reads and long command outputs are the usual space hogs.
- Put rules you always want followed in `CLAUDE.md`, not in an early chat message.
- Start a fresh context with `/clear` when you switch to unrelated work.

## Learn more

- [Explore the context window](https://code.claude.com/docs/en/context-window)
- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- [Extend Claude Code: context costs](https://code.claude.com/docs/en/features-overview)
- [Commands reference](https://code.claude.com/docs/en/commands)
