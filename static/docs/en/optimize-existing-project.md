# Optimize an existing project for Claude Code

> A 30-minute audit that trims what loads before you type, so every session starts lighter.

This tutorial is for you if a project already uses Claude Code (or you're bringing Claude into a big existing codebase) and sessions feel heavy, slow or expensive. You'll measure a baseline, cut the fixed overhead, fix a few habits and share the result with your team. Plan on about 30 minutes, plus a quick re-check a week later.

New to context? Read [What is the context window?](/learn/01-what-is-context). Starting from scratch? See [Start a new project with Claude Code](/learn/start-new-project).

---

## Step 1: Measure a baseline

**Why:** you can't tell what helped unless you know where you started. Everything that loads before your first message (system prompt, tools, MCP, skills, memory files) is paid again on every request.

**What to check:** open a terminal in the project, start a fresh session with `claude`, and run:

```
/context
```

Write down the total and the biggest fixed parts: system prompt, system tools, MCP tools, skills and **Memory files**. That last list also shows which CLAUDE.md and rules files actually loaded.

Then open a recent, typical session in this dashboard and look at:

- The **System prompt, tools & memory** row: your fixed overhead.
- The **Skills, MCP & reminders** group: the **Skills list**, **MCP server instructions** and **Deferred tools list** rows.
- **Biggest items in context**: the single results that took the most room.

[Reading this dashboard](/learn/06-reading-the-dashboard) explains each row. Remember the dashboard shows estimates; `/context` is the source of truth.

- [ ] Ran `/context` in a fresh session and noted the numbers
- [ ] Opened a typical session in the dashboard and noted the fixed overhead

## Step 2: Audit CLAUDE.md and memory files

**Why:** memory files load in full at session start, in every session.

**What to check:** run `/memory` to list your memory files and open them. Look in all the places they can live:

- `~/.claude/CLAUDE.md` (you, every project)
- `./CLAUDE.md` or `./.claude/CLAUDE.md` (the team)
- `./CLAUDE.local.md` (you, this project)
- `CLAUDE.md` files in subdirectories (they load when Claude works with files there)
- `.claude/rules/` and `~/.claude/rules/`
- Auto memory: `MEMORY.md` loads its first 200 lines or 25KB

**What to change:**

- Delete anything stale, duplicated, contradictory or obvious from the code.
- Keep each file **under 200 lines**, the official target.
- Move instructions that matter only for part of the code into a rule with a `paths` field. It loads only when Claude touches matching files:

```markdown
---
paths:
  - "src/api/**/*.ts"
---

- All API endpoints must include input validation
```

- Move long procedures (release steps, migrations) into a skill.
- Check your `@path` imports: imported files load in full together with the file that imports them, so they don't save context.
- In a monorepo, use the `claudeMdExcludes` setting to skip other teams' CLAUDE.md files.

For a second opinion, `/doctor prompt-audit` finds outdated or conflicting instructions (v2.1.283 or later). More in [CLAUDE.md and memory](/learn/03-claude-md-memory).

- [ ] Found every memory file with `/memory` and `/context`
- [ ] Each CLAUDE.md is under 200 lines
- [ ] Moved area-specific rules to `.claude/rules/` with `paths`

## Step 3: Audit MCP servers

**Why:** with **tool search** (on by default), only tool names and server instructions load at start, so idle servers are cheap. Cheap isn't free, though, and big tool results still land in your context.

**What to check:** run `/mcp` to see every server, its status and tool count. Note the scope of each one:

| Scope | Loads in | Stored in |
| --- | --- | --- |
| Local (default) | This project, only you | `~/.claude.json` |
| Project | This project, whole team | `.mcp.json` in the repo |
| User | All your projects | `~/.claude.json` |

**What to change:**

- Disable servers you don't use from `/mcp`. Remove ones you'll never use.
- Move servers only one project needs out of user scope.
- Prefer a good CLI (`gh`, `aws`, `gcloud`) when one exists: it adds no per-tool listing.
- Make sure nobody set `ENABLE_TOOL_SEARCH=false`, which loads every tool definition upfront.
- Know the output limits: Claude Code warns when an MCP result passes 10,000 tokens, and by default a result over 25,000 tokens is saved to a file instead of filling your context. `MAX_MCP_OUTPUT_TOKENS` changes that limit.

Server instructions are cut at 4,096 characters by default, so long ones don't help. Toggling servers mid-session also resets the prompt cache, so do this audit between sessions.

- [ ] Reviewed every server in `/mcp` and disabled the unused ones
- [ ] Checked that tool search is not turned off

## Step 4: Audit skills, plugins and subagents

**Why:** every skill description sits in the skills list on every turn, used or not. The list has a budget of about 1% of the context window; when it overflows, the least-used skills lose their descriptions and stop triggering well.

**What to check:** run `/skill-doctor` to see what each skill costs and how often you use it. It also lists plugins you haven't used recently. Look at `.claude/skills/`, `~/.claude/skills/`, `.claude/agents/` and `~/.claude/agents/`, and the plugins in `/plugin`.

**What to change:**

- Delete or disable skills, plugins and subagents nobody uses.
- Put the key use case first in each `description`: description plus `when_to_use` is cut at 1,536 characters.
- For skills you only run by hand (deploy, release), add this to the frontmatter. The description then stays out of context until you type `/name`:

```yaml
disable-model-invocation: true
```

More in [MCP, skills and subagents](/learn/04-mcp-skills-subagents).

- [ ] Ran `/skill-doctor` and removed unused skills and plugins
- [ ] Marked manual-only skills with `disable-model-invocation: true`

## Step 5: Reduce tool-output bloat

**Why:** after the fixed overhead, tool results are usually the biggest part of a session: long logs, full test runs, huge files.

**What to change:**

- **Filter commands.** Ask for "only the failures", or use `grep`, `tail` or `head`. Bash output over roughly 30,000 characters is saved to a file with a preview, but a 25,000-character log still costs a lot.
- **Send noisy work to a subagent.** "Use a subagent to run the test suite and report only the failing tests." The output stays in the subagent's window.
- **Block files Claude should never read** with `Read` deny rules in `.claude/settings.json`, such as `Read(./.env)` or `Read(./dist/**)`. A `.claudeignore` file has no effect.
- **Filter with a hook.** A `PreToolUse` hook can rewrite test commands to show only failures. See the example in the costs docs.

```json
{
  "permissions": {
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./dist/**)"]
  }
}
```

- [ ] Added `Read` deny rules for secrets and generated files
- [ ] Wrote down which commands to always filter or send to a subagent

## Step 6: Fix habits seen in the dashboard

**Why:** setup is half the story. The dashboard's recommendations show how sessions actually went. Open your heaviest sessions and match what you see:

| You see… | Likely cause | Fix |
| --- | --- | --- |
| **Big tool outputs** | Full logs, test runs or big file reads | Filter output or use a subagent (Step 5) |
| **Compacting often** | Several tasks in one long session | `/clear` between tasks; see [Compaction: what it is and how to use it](/learn/compaction) |
| **Cache expired after a break** | Coming back after the cache lifetime ran out | If you don't need the history, `/clear` is cheaper; see [Change mid-session or start fresh?](/learn/change-or-restart) |
| **Model changed mid-session** | `/model` switch; each model has its own cache | Pick the model at the start of a session |
| **Many file reads** | Vague prompts, Claude searching around | Name files with `@path`, write specific prompts, delegate exploration |
| **High starting cost** | Heavy CLAUDE.md, skills or MCP | Steps 2–4 |

Daily habits are covered in [Keep your context lean](/learn/02-keep-context-lean) and [Everyday workflows](/learn/05-workflows).

- [ ] Checked my three heaviest sessions and picked one habit to change

## Step 7: Make it stick for the team

**Why:** shared files keep the whole team lean.

**What to change:**

- Commit `.claude/settings.json` (permissions, deny rules, hooks), `CLAUDE.md`, `.claude/rules/`, shared skills and `.mcp.json`.
- Keep personal things in `CLAUDE.local.md` and `.claude/settings.local.json`. Claude Code keeps the local settings file out of git when it creates it; if you create either file by hand, add it to `.gitignore`.
- Add a short "How we use Claude" section to the README: where the rules live, which skills exist, "one task per session, `/clear` between tasks".
- After a week, re-measure in a fresh session with `/context` and compare in the dashboard.

- [ ] Committed shared settings and memory files
- [ ] Added "How we use Claude" to the README
- [ ] Set a reminder to re-measure in a week

---

## Before / after checklist

- [ ] Baseline noted from `/context` and the dashboard
- [ ] Every CLAUDE.md under 200 lines, no stale or duplicate rules
- [ ] Area-specific rules moved to `.claude/rules/` with `paths`
- [ ] Unused MCP servers disabled, tool search on
- [ ] Unused skills and plugins removed, manual skills hidden
- [ ] `Read` deny rules for secrets and generated files
- [ ] Noisy commands filtered or sent to subagents
- [ ] Team files committed, personal files kept local
- [ ] Re-measured after a week: fixed overhead went down

## Learn more

- [Manage costs: reduce token usage](https://code.claude.com/docs/en/costs#reduce-token-usage)
- [Understand context costs](https://code.claude.com/docs/en/features-overview#understand-context-costs)
- [Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)
- [Scale with MCP tool search](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search)
- [MCP output limits and warnings](https://code.claude.com/docs/en/mcp#mcp-output-limits-and-warnings)
- [Control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)
- [Isolate high-volume operations](https://code.claude.com/docs/en/sub-agents#isolate-high-volume-operations)
- [Permissions](https://code.claude.com/docs/en/permissions)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
