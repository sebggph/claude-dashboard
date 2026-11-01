# Keep agents on track: guardrails and monitoring agents

> CLAUDE.md is guidance, hooks and permissions are enforcement: layer them, then add a reviewer agent to check the work.

## Why agents drift or ignore rules

Claude usually follows your instructions, but "usually" has causes you can fix:

- **Compaction.** Long sessions get summarized. Rules you only typed in chat can be lost; the root CLAUDE.md is re-read from disk.
- **A long or vague CLAUDE.md.** Aim for under 200 lines. "Use 2-space indentation" beats "format code nicely".
- **Conflicting instructions.** Claude may pick one arbitrarily.
- **Rules with no exceptions.** CLAUDE.md is context, not enforced configuration. Claude may decide a guideline doesn't apply.

The key idea: **CLAUDE.md is guidance; hooks and permissions are enforcement.** Claude decides about the first; Claude Code applies the second every time. Build layers:

1. **Instructions**: CLAUDE.md and `.claude/rules/`.
2. **Permissions**: deny and ask rules.
3. **Hooks**: scripts at fixed points, like before a tool runs or before Claude stops.
4. **Reviewer agents**: a fresh context that checks the work.
5. **CI**: tests and checks on every push or pull request.
6. **Human review**: a person approves the merge.

## Step 1: Write rules Claude can actually follow

Keep each rule short, specific and checkable. `/doctor prompt-audit` finds outdated or conflicting instructions and proposes edits.

Move area-specific rules into `.claude/rules/`. A rule with `paths` frontmatter loads only when Claude reads or edits a matching file:

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API rules
- Validate every request body with the schema in src/api/schemas/
- Return errors with sendError() from src/api/errors.ts
```

Path-scoped rules are summarized away by compaction until Claude touches a matching file again. A rule that must survive belongs in the root CLAUDE.md. You can also tell compaction what to keep:

```markdown
# Compact instructions

When you compact, keep the test commands, the list of files changed and any rule the user stated in chat.
```

What about IMPORTANT or YOU MUST? If you keep adding emphasis and Claude still misses the line, the file is too long or the line belongs in a hook. See [CLAUDE.md and memory](/learn/03-claude-md-memory).

- [ ] Cut CLAUDE.md to under 200 lines of specific rules
- [ ] Moved area-specific rules to `.claude/rules/` with `paths`
- [ ] Added a "Compact instructions" section

## Step 2: Block what must never happen with permissions

Permission rules decide what Claude can run, read and edit. They are checked in the order deny, then ask, then allow, and **deny rules hold in every permission mode**, including auto and `bypassPermissions`. Add them to `.claude/settings.json`:

```json
{
  "permissions": {
    "ask": ["Bash(git push *)"],
    "deny": [
      "Read(./.env)",
      "Read(./secrets/**)",
      "Edit(/src/gen/**)"
    ]
  }
}
```

Now Claude can't read `.env` (not even with `cat .env`), can't edit generated code, and must ask before `git push`. Rules match tool calls, not intent: `Bash(git push *)` misses `git -C . push`, and a `Read` rule doesn't stop a script that opens the file. Keep branch protection on `main`.

- [ ] Denied secrets and folders Claude must never edit
- [ ] Set `git push` to ask (or deny)

## Step 3: Enforce steps with hooks

Hooks are commands Claude Code runs at fixed lifecycle events. The useful ones here:

| Event | When it fires | Can it block? |
| --- | --- | --- |
| `PreToolUse` | Before a tool call | Yes, blocks the call |
| `PostToolUse` | After a tool call succeeds | No, the tool already ran; stderr goes to Claude |
| `Stop` | When Claude finishes responding | Yes, Claude keeps working |
| `SubagentStop` | When a subagent finishes | Yes, the subagent keeps working |
| `UserPromptSubmit` | Before Claude sees your prompt | Yes, and it can add context |

The hook gets JSON on stdin. **Exit 0** means no objection. **Exit 2** blocks, and what you print to stderr goes back to Claude as the reason.

**Block edits to protected files.** Save this as `.claude/hooks/protect-files.sh` and run `chmod +x` on it:

```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

for pattern in ".env" "package-lock.json" ".git/" "migrations/"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH is protected ($pattern)" >&2
    exit 2
  fi
done
exit 0
```

**Make tests pass before Claude finishes.** Register both hooks in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "pnpm test 1>&2 || exit 2" }
        ]
      }
    ]
  }
}
```

If tests fail, Claude gets the output and keeps going. After eight blocks in a row with no tool call between them, Claude Code lets it stop, so it can't loop forever.

Also useful: a `PostToolUse` formatter hook (see [Start a new project](/learn/start-new-project)) and a `SessionStart` hook with matcher `compact` that echoes key reminders after every compaction.

Two cautions. `prompt` and `agent` hooks let a model decide, so use `command` hooks for hard rules. And **command hooks run with your full user permissions.** Read every hook before enabling it; `claude -p` runs a repo's hooks without a trust prompt.

- [ ] Added a PreToolUse hook for protected paths
- [ ] Added a Stop hook that runs tests or typecheck
- [ ] Reviewed every hook script before enabling it

## Step 4: Add a reviewer subagent

A subagent has its own context window, so it reviews the work without the reasoning that produced it. It still loads your CLAUDE.md and rules. Save this as `.claude/agents/rules-reviewer.md`:

```markdown
---
name: rules-reviewer
description: Checks changed files against CLAUDE.md and .claude/rules. Use proactively after code changes, before committing.
tools: Read, Grep, Glob
model: sonnet
---

You review code you didn't write. You get a list of changed files.

1. Read CLAUDE.md and every file in .claude/rules/ that applies.
2. Read each changed file.
3. For each rule, decide: followed, broken or not relevant.

Report only broken rules, as: file, line, rule, short fix.
Skip style preferences that no rule mentions.
If nothing is broken, say "No rule violations".
```

Claude Code enforces the `tools` list: this reviewer can read but not edit. Adding `Bash` for `git diff` also lets it change files.

How it runs:

- **Automatically**: Claude delegates when the task matches the `description`. "Use proactively" encourages that.
- **By name**: "have the rules-reviewer check my changes".
- **Guaranteed**: type `@` and pick it, or write `@agent-rules-reviewer`.

Another useful one: a `test-runner` with Bash and `model: haiku` that reports only failures. For a general bug hunt, `/code-review` checks your diff in a fresh subagent. See [MCP, skills and subagents](/learn/04-mcp-skills-subagents).

- [ ] Created `.claude/agents/rules-reviewer.md` with read-only tools
- [ ] Ran it once on a real change

## Step 5: Monitor flows across sessions and teams

- **Log every command.** A `PostToolUse` hook with matcher `Bash` and command `jq -r '.tool_input.command' >> ~/.claude/command-log.txt` keeps a simple audit trail.
- **OpenTelemetry.** Set `CLAUDE_CODE_ENABLE_TELEMETRY=1` and an exporter (`OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`). The `claude_code.tool_result` and `claude_code.tool_decision` events show what ran and what was accepted or rejected. A repo's settings can't turn telemetry on: use your shell, user or managed settings.
- **Headless checks in CI.** `claude -p` runs once and exits non-zero on failure. Add `--bare` to skip local hooks and CLAUDE.md, `--allowedTools` with `--permission-mode dontAsk` to limit tools, and `--max-turns` to cap it.
- **Pull requests.** `/install-github-app` sets up GitHub Actions. Code Review (Team and Enterprise) comments on pull requests but never approves or blocks them.
- **Agent teams** (experimental, off by default): `TeammateIdle` and `TaskCompleted` hooks can exit 2 to send a teammate back to work.

- [ ] Added a command log hook or OpenTelemetry
- [ ] Added one Claude check to CI or pull requests (optional)

## Step 6: Check that it works

Never trust a guardrail you haven't seen fire.

1. Run `/hooks` and confirm each hook appears under the right event.
2. Ask Claude to do something forbidden, like "add a comment to .env". You should see the `Blocked:` message.
3. Press `Ctrl+O` for the transcript view. For full detail, start with `claude --debug`.
4. Run `/context` and check **Memory files** to confirm CLAUDE.md loaded.
5. `/agents` now only prints a reminder to ask Claude or edit `.claude/agents/` directly. Mention the agent with `@` to test it.

Then open this dashboard. **Tools used** shows which tools ran, **Subagents** shows each subagent's peak context and tool calls, and the **Hook output** row shows what hooks added. See [Reading this dashboard](/learn/06-reading-the-dashboard).

- [ ] Saw a hook block a deliberately bad action
- [ ] Found the reviewer and hook output in this dashboard

## Problem you see, best guardrail

| Problem you see | Best guardrail |
| --- | --- |
| Edits forbidden files | `Edit(...)` deny rule or PreToolUse hook (exit 2) |
| Reads secrets | `Read(...)` deny rule, plus the sandbox |
| Forgets to run tests | Stop hook that runs the tests |
| Ignores formatting | PostToolUse formatter hook |
| Runs risky commands | Permission `ask` or `deny` |
| Pushes to main | `ask` on `git push`, plus branch protection |
| Drifts after compaction | Short CLAUDE.md, Compact instructions, SessionStart `compact` hook |
| Breaks project conventions | rules-reviewer subagent before committing |
| Subagent misbehaves | Restrict its `tools`, add hooks in its frontmatter |

## Quick tips

- Keep the enforced set small. A hook is for a rule with zero exceptions; preferences stay in CLAUDE.md.
- Repeat a rule in chat? Put it in CLAUDE.md, where it survives compaction. See [Compaction](/learn/compaction).
- Ask Claude to write hooks for you ("write a hook that blocks edits to migrations/"), then read them.

## Learn more

- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Configure permissions](https://code.claude.com/docs/en/permissions)
- [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Monitoring](https://code.claude.com/docs/en/monitoring-usage)
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Code Review](https://code.claude.com/docs/en/code-review)
