# Write your own skill

> Turn a task you repeat into a skill: a short SKILL.md that loads only when it's needed.

## What you'll build

You'll write a real `release-notes` skill, run it, test it and share it with your team. Along the way you'll learn the frontmatter fields that matter, how to keep a skill cheap in context, and how to check it in this dashboard. For the basics of skills next to MCP and subagents, see [MCP, skills and subagents](/learn/04-mcp-skills-subagents).

Reading time: about 9 minutes. Tick the boxes as you go.

## Step 1: Know when a skill is the right tool

Create a skill when you keep pasting the same instructions, checklist or procedure into chat, or when a section of CLAUDE.md has grown into a procedure rather than a fact.

| Feature | When it loads | Best for |
| --- | --- | --- |
| CLAUDE.md | Every session, automatically | "Always do X" rules, commands, conventions |
| Skill | Name and description listed; full text on demand | Reference material and workflows you run with `/name` |
| Custom command (`.claude/commands/*.md`) | Same as a skill | The older format. Still works, but skills add supporting files |
| Subagent | Its own context window | Heavy reading; only a summary comes back |

Why skills are context-friendly: at session start, Claude sees only each skill's **name and description**. The full `SKILL.md` loads when you type `/name` or when Claude decides it's relevant. Supporting files load only if Claude reads them. So a long reference costs almost nothing until you need it.

- [ ] Picked one task I repeat often enough to turn into a skill

## Step 2: Learn where skills live and what goes in them

A skill is a folder with a `SKILL.md` file. Where you save it decides who gets it:

| Location | Path | Loads in |
| --- | --- | --- |
| Project | `.claude/skills/<name>/SKILL.md` | This repository. Commit it to share |
| Personal | `~/.claude/skills/<name>/SKILL.md` | All your projects on this machine |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Wherever the plugin is enabled, as `/plugin-name:skill-name` |

`SKILL.md` has YAML frontmatter between `---` markers, then markdown instructions. All fields are optional; `description` is the one you should always write. Useful fields:

- `name`: the command you type. Defaults to the folder name.
- `description`: what it does and when to use it. Claude uses this to decide when to load it.
- `when_to_use`: extra trigger phrases, appended to the description.
- `argument-hint`: shown in autocomplete, for example `[version]`.
- `disable-model-invocation: true`: only you can run it with `/name`.
- `allowed-tools`: tools Claude can use without asking, during the turn that runs the skill.
- `model` and `effort`: override them for the rest of that turn.
- `context: fork`: run the skill in a subagent.

Field names must match exactly: Claude Code silently ignores a field it doesn't recognize.

**Arguments.** `$ARGUMENTS` is replaced with whatever you type after the name. `$0`, `$1` pick single arguments.

**Live shell output.** A line that starts with `!` followed by a command in backticks (you'll see one in Step 3) runs before Claude sees the skill, and the output replaces the line. If the command fails, the whole skill invocation aborts.

- [ ] Decided between a project skill and a personal skill

## Step 3: Build a release-notes skill

Create the folder and two files:

```text
.claude/skills/release-notes/
├── SKILL.md
└── template.md
```

`SKILL.md`:

```markdown
---
name: release-notes
description: Drafts release notes from recent git commits. Use when the user asks for release notes, a changelog entry, or "what's new" for a version.
argument-hint: [version]
allowed-tools: Bash(git log *)
---

## Recent commits

!`git log --oneline -30`

## Your task

Write release notes for version $ARGUMENTS from the commits above.

1. Group changes into Added, Changed, Fixed. Skip merge commits and chores.
2. One plain-language line per change, written for users, not developers.
3. Follow the format in [template.md](template.md).
4. If a commit is unclear, list it under "Needs review" instead of guessing.
```

`template.md`:

```markdown
## [version] - [date]

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

The `allowed-tools` line pre-approves the `git log` command, so the injected command doesn't stop on a permission check. The template lives in its own file, so it loads only when Claude follows the link.

- [ ] Created `SKILL.md` and `template.md` in `.claude/skills/release-notes/`

## Step 4: Run it and test it

There are two ways to run a skill:

```text
/release-notes 1.4.0
```

Or just ask in words that match the description, and Claude loads it on its own:

```text
Can you write the release notes for 1.4.0?
```

To test it properly:

1. Start a **fresh session**. Leftover context from writing the skill hides gaps in the instructions.
2. Ask `What skills are available?` and check `release-notes` is listed.
3. Try both the `/release-notes` form and a natural request.
4. Try a request that should **not** trigger it, such as "explain this function".

Claude Code watches skill folders, so edits to `SKILL.md` apply in the current session. If Claude can't match the description but `/release-notes` works, the YAML may be broken: start with `claude --debug` to see the parse error, or run `claude plugin validate .claude/skills`.

- [ ] Ran it with `/release-notes` and with a natural request
- [ ] Checked it doesn't trigger on unrelated requests

## Step 5: Write a great description and keep the body short

The description is the only part Claude sees before deciding. Make it count:

- **Put the key use case first.** Long descriptions get cut in the listing.
- **Use words people actually say**: "release notes", "changelog", "what's new".
- **Say when not to use it** if it overlaps with another skill.
- **Triggers too often?** Make it more specific, or add `disable-model-invocation: true`.

Keep the body itself lean. Once a skill loads, its content stays in the conversation, so every line is a recurring cost. State what to do, not why. The docs suggest keeping `SKILL.md` under 500 lines and moving detailed reference into separate files linked from `SKILL.md`, so Claude knows what each one holds and when to read it.

Put the most important instructions near the top: after compaction, Claude Code keeps only the first 5,000 tokens of each invoked skill. And if a rule must hold every time, use a hook, not a skill.

- [ ] Rewrote the description with the main use case first
- [ ] Moved long reference material into a separate file

## Step 6: Version it and share it

A project skill is just files. Commit `.claude/skills/` and everyone who clones the repo gets `/release-notes`. Review skill changes in pull requests like code.

Two things to know before sharing:

- **Review `allowed-tools`** in skills you get from a repository. A skill can grant itself tool access, so read it before you run Claude Code there.
- **Plugins** package skills with subagents, hooks and MCP servers into one installable unit, handy when several repositories need the same skills. Plugin skills are namespaced, like `/my-plugin:review`.

A real-world example: this dashboard keeps itself up to date with a skill. Look at `.claude/skills/update-dashboard/SKILL.md` in the repository. It keeps a short `SKILL.md` with steps, puts the long fact list in `facts.md` and `sources.md`, takes a focus through `$ARGUMENTS`, and uses `disable-model-invocation: true` because it should only run when asked.

- [ ] Committed the skill folder
- [ ] Read the update-dashboard skill as a model

## Step 7: Check what it costs

Every skill Claude can invoke on its own adds its name and description to every request.

- **Listing budget**: the skill listing gets about 1% of the model's context window. When it overflows, Claude Code drops descriptions of the skills you use least.
- **Per-skill cap**: `description` plus `when_to_use` is cut at 1,536 characters.
- **Hand-run skills**: with `disable-model-invocation: true`, the description stays out of context until you invoke it.
- **Find unused skills**: `/skill-doctor` shows what each skill costs and how often it's used.
- **Check the total**: the Skills row in `/context` shows the listing's size.

In this dashboard, open a session and look at the **Skills, MCP & reminders** group. The **Skills list** row is your listing's size. Compare it before and after adding skills. If **System prompt, tools & memory** is large too, the **Memory files** card shows whether CLAUDE.md is the cause, and long CLAUDE.md sections are good candidates for new skills. See [Reading this dashboard](/learn/06-reading-the-dashboard).

- [ ] Ran `/context` and checked the Skills row
- [ ] Compared the Skills list row in this dashboard

## Common mistakes

| Mistake | What happens | Fix |
| --- | --- | --- |
| Vague description ("helper for stuff") | Claude never loads it, or loads it at the wrong time | Name the task and the words people use |
| Typo in a field name (`allowed_tools`) | Field silently ignored | Copy names exactly from the docs |
| Huge `SKILL.md` | Every line stays in context after loading | Move detail into linked files |
| Side effects with auto-invocation | Claude may deploy or post on its own | Add `disable-model-invocation: true` |
| Injected command that can fail | The whole skill aborts | Make sure the command exits with 0 when nothing is wrong |
| A must-never-break rule in a skill | Claude may stop following it later | Use a hook |

## Quick tips

- Write the skill after you've done the task by hand once or twice with Claude.
- Test in a fresh session, with and without the skill.
- Use `$ARGUMENTS` instead of hard-coding versions, files or issue numbers.
- Turn long CLAUDE.md procedures into skills; keep CLAUDE.md for facts.
- Run `/skill-doctor` now and then and remove skills you never use.

## Learn more

- [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Extend Claude Code](https://code.claude.com/docs/en/features-overview)
- [Commands](https://code.claude.com/docs/en/commands)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Plugins overview](https://code.claude.com/docs/en/plugins/overview)
- [Create a plugin](https://code.claude.com/docs/en/plugins/create)
- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
