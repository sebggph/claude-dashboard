# Secure your Claude Code setup

> A step-by-step hardening pass: the right mode, tight rules, a sandbox, safe secrets and trusted extensions.

## What you'll set up

Claude Code can run commands, edit files and reach the network on your behalf. A few settings decide how much it can do without asking and what it can reach if something goes wrong, for example after reading a page with hidden instructions (see [Prompt injection](/learn/prompt-injection)). You'll choose a permission mode, write allow, ask and deny rules, turn on the sandbox, protect secrets, check MCP servers and hooks, and keep Claude Code updated.

Reading time: about 8 minutes. Tick the boxes as you go.

## Step 1: Know your permission mode

The permission mode sets what Claude can do without asking. Press `Shift+Tab` to cycle modes; the status bar shows the active one.

| Mode | Runs without asking | Use it for |
| --- | --- | --- |
| `default` (Manual) | Reads only | Sensitive work, unfamiliar code |
| `acceptEdits` | Reads, file edits, common filesystem commands | Iterating on code you review |
| `plan` | Reads; edits wait for an approved plan | Exploring before changing |
| `auto` | Everything, with a classifier checking actions | Long tasks you trust the direction of |
| `dontAsk` | Only pre-approved tools; the rest is denied | Locked-down CI and scripts |
| `bypassPermissions` | Everything | Isolated containers and VMs only |

Since v2.1.283, interactive terminal and VS Code sessions start in **auto mode** by default. The docs warn it "does not guarantee safety", so for unfamiliar code start in Manual mode:

```bash
claude --permission-mode default
```

Never use `bypassPermissions` (or `--dangerously-skip-permissions`) on your own machine. It offers no protection against prompt injection. Writes to protected paths like `.git`, `.claude` and `.vscode` are never auto-approved in the other modes.

- [ ] Checked which mode my sessions start in
- [ ] Use Manual or plan mode for code I don't know

## Step 2: Write allow, ask and deny rules

Rules sit on top of the mode. Claude Code checks **deny first, then ask, then allow**, and the first match wins. Deny rules hold in every mode; ask rules still prompt even in auto mode. Rules are enforced by Claude Code itself, not by the model, so they're stronger than a line in CLAUDE.md.

A small, safe `.claude/settings.json`:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(npm test)",
      "Bash(npm run lint)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(curl *)",
      "Bash(wget *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)"
    ]
  }
}
```

Two limits to know:

- A Bash rule matches the command as written. `Bash(curl *)` doesn't catch `/usr/bin/curl` or `sh -c 'curl ...'`.
- `Read` deny rules cover Claude's file tools and commands like `cat`, but not a script that opens files itself. The sandbox (Step 3) closes that gap.

Project `allow` rules only apply after you accept the workspace trust dialog, which lists them first. Read that list when you open someone else's repo. Run `/permissions` to see every rule and the file it came from.

- [ ] Added deny rules for `.env` and secret folders
- [ ] Put `git push` and network commands under `ask`
- [ ] Reviewed my rules with `/permissions`

## Step 3: Turn on the sandbox

The sandbox is an operating-system boundary around the shell commands Claude runs, and the processes they start. It's off by default. Turn it on in a session:

```text
/sandbox
```

Choose **auto-allow** (sandboxed commands run without prompts) or **regular permissions** (prompts as usual). By default, sandboxed commands can write only to the working directory and a temp folder, and network traffic goes through a proxy that allows only the domains you approve. Reads still reach most of the machine, so protect credential files explicitly:

```json
{
  "sandbox": {
    "enabled": true,
    "credentials": {
      "files": [
        { "path": "~/.aws/credentials", "mode": "deny" },
        { "path": "~/.ssh", "mode": "deny" }
      ]
    }
  }
}
```

What it doesn't cover: Claude's file and web tools, MCP servers and hooks run outside it. It works on macOS, Linux and WSL2 (Linux needs `bubblewrap` and `socat`), not native Windows. If it can't start, Claude Code runs commands unsandboxed unless you set `sandbox.failIfUnavailable` to `true`.

- [ ] Ran `/sandbox` and picked a mode
- [ ] Denied my credential files to sandboxed commands

## Step 4: Isolate untrusted code

For more than shell commands, put the whole Claude Code process inside a boundary. The docs compare the options:

- **Dev container**: a team-standard isolated environment. The docs still say to use it with trusted repositories, and not to mount host secrets like `~/.ssh` into it.
- **Virtual machine or cloud session**: the recommendation for an **untrusted repository**.
- **Sandbox runtime**: wraps the whole process, including MCP servers and hooks, without Docker.

When you script `claude -p` over a repo you didn't write, remember it shows no trust dialog. Start with `--bare`, or pass `--settings '{"disableAllHooks": true}'`, so the repo's hooks and servers don't run.

- [ ] Picked where untrusted repos run (VM or cloud session)

## Step 5: Handle secrets

- Keep secrets in environment variables or `.env` files, never in code, CLAUDE.md or prompts. CLAUDE.md loads into every session and is usually shared through git.
- Add `.env`, `.claude/settings.local.json` and `CLAUDE.local.md` to `.gitignore`.
- In a shared `.mcp.json`, reference keys as `${API_KEY}` instead of pasting them. Claude Code expands the variable.
- Set `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` to strip credentials from the environment of Bash commands, hooks and stdio MCP servers.

- [ ] No secrets in CLAUDE.md, settings or `.mcp.json`
- [ ] `.env` and local files are in `.gitignore`

## Step 6: Trust MCP servers carefully

Use servers you wrote or from providers you trust. Anthropic reviews Directory connectors but doesn't security-audit any MCP server, and servers that fetch outside content can expose you to prompt injection.

| Scope | Loads in | Stored in |
| --- | --- | --- |
| Local (default) | This project, only you | `~/.claude.json` |
| Project | This project, whole team | `.mcp.json` (committed) |
| User | All your projects | `~/.claude.json` |

Claude Code asks before using servers from a project's `.mcp.json`. A cloned repo can't approve its own servers. You can also limit server tools with rules such as `mcp__github__*`, and check status with `/mcp`.

- [ ] Every connected server comes from a source I trust
- [ ] Checked `/mcp` for servers I didn't add

## Step 7: Use hooks as guardrails

Hooks run your own code at fixed points. A `PreToolUse` hook can block a tool call before it runs, and its `"deny"` holds in every permission mode. This one, from the docs, sends `rm` commands to a script:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh"
          }
        ]
      }
    ]
  }
}
```

The script reads the command with `jq` and returns `"permissionDecision": "deny"` when it contains `rm -rf`. The full script is in the hooks reference.

Hooks have their own risk: **command hooks run with your full user permissions.** Read every hook before you add it, especially in a repo you cloned. Check them with `/hooks`.

- [ ] Added one blocking hook (optional)
- [ ] Reviewed every hook in my settings

## Step 8: Stay updated and check what you commit

Native installs update themselves; Homebrew and WinGet need `brew upgrade claude-code` or `winget upgrade Anthropic.ClaudeCode`. The changelog lists security fixes. Run `claude --version` to see your version.

| File | Commit it? |
| --- | --- |
| `.claude/settings.json` (shared rules, hooks) | Yes, after review |
| `.mcp.json` (with `${VAR}` references) | Yes |
| `.claude/settings.local.json`, `CLAUDE.local.md` | No |
| `.env`, keys, credentials | Never |

**Teams and companies** can deploy managed settings that users and projects can't override, for example to deny secret reads or set `disableBypassPermissionsMode` to `"disable"`. Run `/status` to see which settings sources apply to you.

- [ ] Claude Code is up to date
- [ ] Only shared, secret-free files are committed

## Your security checklist

- [ ] Right mode for the job, never bypass on my machine
- [ ] Deny rules for secrets, ask rules for push and network
- [ ] Sandbox on, credential files denied
- [ ] Untrusted repos in a VM or cloud session
- [ ] Secrets out of git, CLAUDE.md and `.mcp.json`
- [ ] Only trusted MCP servers and reviewed hooks
- [ ] Claude Code updated

Next: review what Claude writes with [Code quality and security reviews](/learn/code-quality-security).

## Learn more

- [Security](https://code.claude.com/docs/en/security)
- [Choose a permission mode](https://code.claude.com/docs/en/permission-modes)
- [Configure permissions](https://code.claude.com/docs/en/permissions)
- [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)
- [Choose a sandbox environment](https://code.claude.com/docs/en/sandbox-environments)
- [Development containers](https://code.claude.com/docs/en/devcontainer)
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Deploy managed settings](https://code.claude.com/docs/en/managed-settings)
- [Claude Code changelog](https://code.claude.com/docs/en/changelog)
