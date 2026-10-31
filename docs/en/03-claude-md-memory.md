# CLAUDE.md and memory

> CLAUDE.md is a short note Claude reads at the start of every session. Keep it small, specific and useful.

## Two kinds of memory

| | CLAUDE.md | Auto memory |
| --- | --- | --- |
| Who writes it | You | Claude |
| What's in it | Instructions and rules | Learnings and preferences |
| When it loads | Every session | Every session (first 200 lines or 25KB of `MEMORY.md`) |

Both load into context at the start, so both cost tokens on every request.

## Where CLAUDE.md files live

| Scope | Location | Shared with |
| --- | --- | --- |
| User | `~/.claude/CLAUDE.md` | Only you, all projects |
| Project | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Your team, via git |
| Local | `./CLAUDE.local.md` (add to `.gitignore`) | Only you, this project |

Organizations can also deploy a managed CLAUDE.md. Files in subdirectories load on demand, when Claude works with files there.

Auto memory lives in `~/.claude/projects/<project>/memory/`. It is local to your machine.

## What to put in it

Write down what Claude can't figure out from the code:

- Exact commands to install, test, typecheck and lint.
- Places where the code is misleading.
- Team decisions that aren't in the repo.
- Anything you've had to correct twice.

Be concrete. "Run `npm test` before committing" works better than "Test your changes".

## Keep it short

Every line loads into every session. The official guidance is to stay **under 200 lines** per file. Longer files use more context and are followed less reliably.

If something is a long procedure or only matters sometimes, move it to a **skill** (loads on demand) or a path-scoped rule in `.claude/rules/`.

## Example

```markdown
# Commands
- Install: pnpm install
- Run one test file: pnpm vitest run path/to/file.test.ts
- Typecheck: pnpm tsc --noEmit

# Conventions
- Use the error helpers in src/lib/errors.ts, never throw raw strings
- src/legacy/ is still live but don't copy its patterns into new code

# Gotchas
- Integration tests need DATABASE_URL set, see .env.example
```

## Useful commands

- `/init` creates a starting CLAUDE.md from your codebase. If one exists, it suggests improvements. After that, the work is mostly removing lines.
- `/memory` lists your memory files, opens them in your editor, and lets you turn auto memory on or off.
- `/context` confirms which memory files loaded.

## Imports

A CLAUDE.md can pull in other files with `@path`:

```text
See @README for project overview and @package.json for available npm commands.
```

Imports help you organize, but they don't save context: imported files load together with the CLAUDE.md that imports them.

## Quick tips

- Start with `/init`, then cut.
- Stay under 200 lines.
- Use `CLAUDE.local.md` for personal, project-only preferences.
- Move workflows and reference docs into skills.
- A rule that must never be broken belongs in a hook, not in CLAUDE.md.
- Say "remember that..." and Claude saves it to auto memory.

## Learn more

- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Best practices](https://code.claude.com/docs/en/best-practices)
- [Extend Claude Code](https://code.claude.com/docs/en/features-overview)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
