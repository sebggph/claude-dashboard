# Automate with hooks

> Let Claude Code format, notify, log and check for you at fixed moments, without spending prompts on it.

## What you'll set up

Hooks are commands Claude Code runs at fixed points: after an edit, when Claude needs you, at session start, before Claude stops. The model doesn't decide, so they run every time. This guide uses them for **productivity**: less typing, less waiting, cleaner output. For blocking dangerous actions, see [Guardrails and monitoring](/learn/guardrails-and-monitoring) and [Secure your setup](/learn/secure-setup).

Reading time: about 9 minutes. Most recipes need `jq` (`brew install jq` or `apt-get install jq`).

## Step 1: Learn the moving parts

Hooks live under a `hooks` key in a settings file. Each event holds a list of groups, each with an optional `matcher` and the hooks to run:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "echo edited" }
        ]
      }
    ]
  }
}
```

The events you'll use most:

| Event | When it fires | Matcher filters |
| --- | --- | --- |
| `SessionStart` | A session begins or resumes | `startup`, `resume`, `clear`, `compact`, `fork` |
| `UserPromptSubmit` | You submit a prompt, before Claude sees it | No matcher |
| `PreToolUse` | Before a tool call (can block it) | Tool name |
| `PostToolUse` | After a tool call succeeds | Tool name |
| `Notification` | Claude Code sends a notification | `permission_prompt`, `idle_prompt`, ... |
| `Stop` | Claude finishes responding | No matcher |
| `SubagentStop` | A subagent finishes | Agent type |
| `PreCompact` | Before compaction | `manual`, `auto` |
| `SessionEnd` | The session ends | Why it ended |

The reference lists more. Matchers are case-sensitive; `Edit|Write` matches either tool, and an empty matcher fires every time.

**How a hook talks to Claude Code.** The event data arrives as JSON on stdin, for example `tool_name`, `tool_input` and `cwd`. Your command answers with its exit code:

- **Exit 0**: no objection. Claude Code can also read a JSON object you print to stdout for finer control.
- **Exit 2**: block (on events that can block). What you print to stderr goes back as the reason.
- **Other codes**: usually a non-blocking error; the action goes ahead.

- [ ] Know which event fits "after an edit", "when Claude needs me" and "before Claude stops"

## Step 2: Choose where the hook lives

| File | Scope | Commit it? |
| --- | --- | --- |
| `~/.claude/settings.json` | All your projects | No, it's on your machine |
| `.claude/settings.json` | This project, whole team | Yes, after review |
| `.claude/settings.local.json` | This project, only you | No |

Put personal habits (notifications, your own logs) in user settings, and team conventions (formatting, tests) in the project file. Settings are strict JSON: no comments, no trailing commas. If a file already has a `hooks` key, add the new event next to the existing ones instead of replacing the object.

Run `/hooks` to browse every configured hook by event and see which file it came from. Or ask Claude to write the hook for you.

- [ ] Picked user or project settings for each hook

## Step 3: Auto-format after every edit

This `PostToolUse` hook passes each edited file to Prettier. Put it in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

Swap in your own formatter. A successful hook shows nothing, so check the file. Edits made through shell commands aren't matched.

- [ ] Added a formatter hook and saw a file reformatted

## Step 4: Get notified instead of watching the terminal

Add this to `~/.claude/settings.json` so you hear from Claude when it waits for you. On macOS use `osascript`; on Linux, `notify-send`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

`permission_prompt` fires when an approval has waited about six seconds; `idle_prompt` fires about 60 seconds after Claude finished and you haven't typed. Want a ping the moment a turn ends? Put the same command under `Stop`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "notify-send 'Claude Code' 'Done'" }
        ]
      }
    ]
  }
}
```

On macOS, if nothing appears, allow notifications for **Script Editor** in System Settings. `notify-send` needs a desktop, not an SSH session.

- [ ] Got a notification while working in another window

## Step 5: Add context at session start

On `SessionStart`, plain text your command prints to stdout is added to Claude's context. This gives Claude a short picture of your working tree:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          { "type": "command", "command": "git status --short | head -20" }
        ]
      }
    ]
  }
}
```

**This costs context.** Whatever the hook prints sits in the conversation from then on, so keep it to a few lines, hence the `head -20`. For fixed facts, use CLAUDE.md instead. To restore key reminders after compaction, use the matcher `compact` (see [Compaction](/learn/compaction)).

- [ ] Added a short SessionStart hook and checked its output

## Step 6: Log what Claude does

A `PostToolUse` hook with no matcher runs after every tool call. This one adds a line per call to a log file:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "jq -c '{time: now | todate, tool: .tool_name}' >> ~/.claude/tool-log.jsonl",
            "async": true
          }
        ]
      }
    ]
  }
}
```

`"async": true` runs it in the background, so Claude doesn't wait. Async hooks can't block anything, which is fine for a log. Use `"matcher": "Bash"` and `.tool_input.command` to log only shell commands.

- [ ] Added a log hook and read the file after a session

## Step 7: Run the tests before Claude stops

A `Stop` hook that exits 2 sends Claude back to work. Send the test output to stderr so Claude sees why:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "npm test 1>&2 || exit 2" }
        ]
      }
    ]
  }
}
```

`Stop` fires every time Claude finishes responding, not only when a task is done, so use a fast command. After eight blocks in a row with no tool call in between, Claude Code lets it stop anyway. Scripts can read `stop_hook_active` from the input to avoid loops. More patterns are in [Guardrails and monitoring](/learn/guardrails-and-monitoring).

- [ ] Added a Stop hook with a quick test or typecheck

## Step 8: Keep hooks cheap in context and tokens

Hooks run outside the model, so most cost nothing. Output only matters where it reaches Claude:

- **Reaches Claude**: plain stdout from `SessionStart` and `UserPromptSubmit`, `additionalContext` in JSON, and stderr on exit 2 (for example a failing test run).
- **Stays out**: stdout from most other events, like the formatter and the logger, which goes only to the debug log.
- **Capped**: text a hook adds is limited to 10,000 characters. Longer output is saved to a file and Claude gets a 2,000-character preview.

Hooks can also **save** tokens: the costs guide shows one that filters test output down to the failures. In this dashboard, the **Hook output** row shows what your hooks added (see [Reading this dashboard](/learn/06-reading-the-dashboard)).

- [ ] Checked the Hook output row for a session

## Step 9: Stay safe

- **Command hooks run with your full user permissions.** They can read, change or delete anything your account can. Read every hook before enabling it.
- In an interactive session, hooks wait until you accept the workspace trust dialog. `claude -p` shows no dialog and runs a repo's hooks, so review `.claude/` first or pass `--settings '{"disableAllHooks": true}'`.
- Commit `.claude/settings.json` only with hooks your team has reviewed. Keep personal hooks in user or local settings.
- In scripts, quote variables (`"$VAR"`), use `"$CLAUDE_PROJECT_DIR"` for paths, and skip `.env` and keys.

- [ ] Reviewed every hook in my settings files

## Step 10: Test and debug a hook

1. Run `/hooks` and confirm it's listed under the right event.
2. Test a script by hand with sample input:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | ./my-hook.sh
echo $?
```

3. Make scripts executable with `chmod +x`.
4. Press `Ctrl+O` for the transcript view. Errors show as `<hook name> hook error`.
5. For full detail, start with `claude --debug-file /tmp/claude.log`, or run `/debug` mid-session.

If JSON output has no effect, check that nothing else prints first (like an `echo` in your shell profile) and that fields like `additionalContext` sit inside `hookSpecificOutput`.

- [ ] Ran one hook by hand with sample JSON

## Quick tips

- Start with one hook, see it fire, then add the next.
- Hooks are for things that must happen every time. Preferences belong in [CLAUDE.md](/learn/03-claude-md-memory).
- To pause all hooks, set `"disableAllHooks": true`.

## Learn more

- [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Settings](https://code.claude.com/docs/en/settings)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)
