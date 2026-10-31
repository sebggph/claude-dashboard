# Everyday workflows

> A few simple routines make Claude Code faster, cheaper and safer to use every day.

## Explore, plan, code, commit

A reliable loop for most changes:

1. **Explore.** Ask Claude to read the relevant code first. For big searches, ask it to use a subagent so the reading stays out of your context.
2. **Plan.** Switch to plan mode with `Shift+Tab` (or `/plan`). Claude proposes a plan and makes no edits until you approve.
3. **Code.** Approve the plan and let Claude implement it. Give it a check to run, like your test command.
4. **Commit.** Ask Claude to commit with a clear message, or open a pull request.

Watch the first minute. Press `Esc` the moment Claude drifts. It stops and keeps the work so far.

## Pick up where you left off

Sessions are saved locally, so you don't need to re-explain.

| Command | What it does |
| --- | --- |
| `claude -c` / `claude --continue` | Reopens the most recent session in this folder |
| `claude -r` / `claude --resume` | Opens the session picker |
| `claude --resume <name>` | Resumes a named session |
| `/resume` | Switches session from inside Claude Code |

Name sessions so they are easy to find: `/rename auth-refactor`, or start with `claude -n auth-refactor`.

## Undo with checkpoints

Every prompt you send creates a checkpoint. Run `/rewind` (or press `Esc` twice on an empty prompt) to:

- Restore code, conversation, or both, to an earlier point.
- Summarize part of the conversation to free space.

This makes it safe to try a bold idea first. Note: checkpoints track edits made by Claude's file tools. Changes made by Bash commands are not tracked, so keep using git.

## Run Claude from scripts

Use `-p` to run once and exit. It's great for CI, git hooks and shell loops:

```bash
git log --oneline -20 | claude -p "summarize these recent commits"
```

Useful flags:

- `--output-format json` for a result you can parse.
- `--allowedTools "Read,Edit"` to pre-approve tools.
- `--max-turns 20` to cap a run.
- `--bare` to skip CLAUDE.md, skills, hooks and MCP for repeatable runs (needs an API key).

## Choose the right model

- Switch with `/model`. Aliases like `sonnet`, `opus` and `haiku` pick the latest version.
- Sonnet handles most coding tasks well and costs less than Opus.
- Haiku is a good fit for simple subagent jobs.
- `/effort` controls how hard Claude thinks. Raise it for tricky bugs, lower it for quick back-and-forth.

Each model has its own prompt cache, so switching models mid-task makes the next turn slower and more expensive. Pick your model at the start of a session.

## Quick tips

- Plan first for anything bigger than a small fix.
- `Esc` to stop, `/rewind` to undo, `/clear` to start over.
- Name sessions you will come back to.
- Use `claude -p` for repeatable tasks.
- Set model and effort at the start, not mid-task.

## Learn more

- [Common workflows](https://code.claude.com/docs/en/common-workflows)
- [Best practices](https://code.claude.com/docs/en/best-practices)
- [Manage sessions](https://code.claude.com/docs/en/sessions)
- [Checkpointing](https://code.claude.com/docs/en/checkpointing)
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- [CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Model configuration](https://code.claude.com/docs/en/model-config)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
