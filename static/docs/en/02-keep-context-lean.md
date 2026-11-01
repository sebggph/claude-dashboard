# Keep your context lean

> Small, focused sessions cost less and give better answers. These habits keep your context clean.

## Clear between tasks

When you switch to unrelated work, run `/clear`. It starts a new, empty conversation and costs nothing. Your old session is saved, so you can come back with `/resume`.

Name the session you're leaving so it's easy to find later:

```
/clear oauth-migration
```

## Compact with a focus

If you want to keep going but the history is long, run `/compact` and tell it what to keep:

```
/compact keep the API changes and the test commands
```

Note: on a long session, `/compact` is itself a big request, because it reads the whole conversation to summarize it. If you don't need continuity, `/clear` is cheaper.

You can also summarize just part of the chat: run `/rewind`, pick a message, and choose **Summarize from here** or **Summarize up to here**.

## Plan before you edit

For bigger changes, use **plan mode**. Claude reads files and proposes a plan, but makes no edits until you approve. Press `Shift+Tab` until the status bar shows plan mode, or start with:

```bash
claude --permission-mode plan
```

A good plan avoids wrong turns, and wrong turns fill your context with work you'll throw away.

## Point Claude at the right files

- Mention files directly with `@`, for example `Explain the logic in @src/utils/auth.js`. Claude gets that file instead of searching around.
- A directory mention like `@src/components` gives a file listing, not file contents.
- Be specific in your prompt. "Fix the date bug in `invoice.ts`" beats "fix the bug".

## Don't dump huge outputs

Long logs and full test runs land in context and stay there. Instead:

- Ask for only what matters: "run the tests and show only failures".
- Pipe a filtered log from your shell: `cat error.log | claude -p "what's going on here"`.
- For noisy work, use a subagent (next section).

## Use subagents for exploration

A subagent works in its own context window and returns only a summary:

```
use a subagent to investigate how our auth system handles token refresh
```

The file reads stay in the subagent's window, not yours.

## Trim MCP servers

MCP tool definitions are deferred by default, so idle servers cost little. Still, run `/mcp` to see your servers and disable the ones you're not using. When a good CLI exists (like `gh`), Claude can often use it directly with no per-tool listing at all.

## Quick side questions

Use `/btw` for a quick question. It answers without adding to the conversation history.

## Quick tips

- One task per session. `/clear` when the topic changes.
- After two failed corrections, `/clear` and write a better prompt.
- Use `/compact <focus>` at natural breaks, not mid-task.
- Use `@file` mentions instead of "look around the repo".
- Send big searches, logs and test runs to a subagent.
- Run `/context` to see what's actually using space.

## Learn more

- [Explore the context window](https://code.claude.com/docs/en/context-window)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
- [Best practices](https://code.claude.com/docs/en/best-practices)
- [Common workflows](https://code.claude.com/docs/en/common-workflows)
- [Checkpointing](https://code.claude.com/docs/en/checkpointing)
