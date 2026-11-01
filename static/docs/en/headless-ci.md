# Claude in scripts and CI (headless mode)

> Run Claude once, without a chat window, so scripts, git hooks and CI jobs can use it like any other command-line tool.

## What headless mode is

Add `-p` (or `--print`) to any `claude` command and it runs **non-interactively**: it takes your prompt, does the work, prints the result and exits.

```bash
claude -p "What does the auth module do?"
```

It reads stdin, so you can pipe data in and redirect the answer out. It exits with code `0` on success and a non-zero code when the run fails, so scripts can branch on the result.

Good fits:

- **Scripts and build steps**: a project-specific linter or reviewer.
- **Git hooks**: summarize or check a change before it goes anywhere.
- **CI**: review pull requests, answer `@claude` mentions, write reports.
- **Batch jobs**: run the same focused task over many files at night.

## What changes compared with interactive use

**Nobody is there to approve anything.** In a `-p` run that sets no permission mode, a tool call that needs approval is simply denied. You decide permissions up front, with `--allowedTools` or a permission mode. Tools that need no approval, like reading files in your working directory, still run.

**It still loads your setup, unless you say otherwise.** Without extra flags, `claude -p` discovers hooks, skills, plugins, MCP servers, auto memory and CLAUDE.md just like an interactive session. It even runs the hooks in a project's `.claude/settings.json` and connects the servers in its `.mcp.json` in a folder you never trusted, with no trust dialog.

**`--bare` gives you a clean, repeatable run.** It skips all of that auto-discovery, so a hook in a teammate's `~/.claude` or a server in `.mcp.json` won't run. Claude gets the Bash, file read and file edit tools, and you pass anything else explicitly (`--append-system-prompt`, `--settings`, `--mcp-config`, `--agents`). Two catches:

- Bare mode doesn't use your subscription login. Set `ANTHROPIC_API_KEY` (or use your cloud provider's credentials).
- Claude can't run background commands or background subagents.

The docs recommend `--bare` for scripted calls, and say it will become the default for `-p` in a future release.

## The flags you'll actually use

| Flag | What it does |
| --- | --- |
| `-p`, `--print` | Run once, non-interactively, and exit |
| `--bare` | Skip hooks, skills, plugins, MCP, auto memory and CLAUDE.md |
| `--output-format` | `text` (default), `json` (result plus metadata) or `stream-json` (one JSON event per line) |
| `--json-schema` | With `json` output, return data matching your schema in `structured_output` |
| `--allowedTools` | Tools that run without asking, e.g. `"Read,Edit"` or `"Bash(git diff *)"` |
| `--disallowedTools` | Deny rules: `"Edit"` removes the tool, `"Bash(rm *)"` blocks matching calls |
| `--tools` | Restrict which built-in tools exist at all; `""` disables all |
| `--permission-mode` | Baseline such as `dontAsk`, `acceptEdits` or `auto` |
| `--max-turns` | Cap the agentic turns; exits with an error when reached |
| `--max-budget-usd` | Stop once estimated spend reaches this amount |
| `--model` / `--effort` | Pick the model (`sonnet`, `opus`, `haiku`...) and how hard it thinks |
| `--append-system-prompt` | Add instructions while keeping the default behavior |
| `--continue` / `--resume <id>` | Continue the latest conversation, or a specific one |
| `--no-session-persistence` | Don't save the session to disk |

A few notes:

- `--permission-mode dontAsk` denies everything that would otherwise prompt. It's the locked-down choice for CI. `acceptEdits` lets Claude write files and run common filesystem commands like `mkdir` and `mv`.
- In `--allowedTools`, the space before `*` matters: `Bash(git diff *)` matches `git diff ...`, but `Bash(git diff*)` would also match `git diff-index`.
- `--max-turns`, `--max-budget-usd`, `--json-schema` and `--no-session-persistence` work only with `-p`.

## Recipes

### 1. Review a diff

Piping the diff in means Claude doesn't need Bash permission to read it:

```bash
git diff main | claude -p "You are a typo linter. For each typo in this diff, report filename:line on one line and the issue on the next. Return nothing else."
```

For a focused security pass on a PR, add a role with `--append-system-prompt`:

```bash
gh pr diff "$1" | claude -p \
  --append-system-prompt "You are a security engineer. Review for vulnerabilities." \
  --output-format json
```

Piped input is capped at 10MB. For bigger inputs, write them to a file and mention the path in your prompt.

### 2. Parse JSON with jq

With `--output-format json`, the text answer is in `result`, next to the session ID and cost data:

```bash
claude -p "Summarize this project" --output-format json | jq -r '.result'
```

For data your script can rely on, add a schema. The answer lands in `structured_output`:

```bash
claude -p "Extract the main function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}' \
  | jq '.structured_output'
```

If Claude declines or the run ends without valid output, `structured_output` is missing, so check for it before using it.

To keep going in a later step, capture the session ID:

```bash
session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id')
claude -p "Continue that review" --resume "$session_id"
```

### 3. GitHub Actions

The documented path is the official action, `anthropics/claude-code-action`. The fastest setup is to run `/install-github-app` inside Claude Code: it installs the Claude GitHub App, saves your credential as a repository secret and opens a pull request with the workflow. You need admin access to the repo.

Doing it by hand? Install the Claude GitHub App, add a secret (`ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` for a subscription), then add a workflow. This one answers `@claude` mentions in issue and PR comments:

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write
      actions: read
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

Good to know:

- With no `prompt` input, Claude waits for `@claude`. With a `prompt` input it runs on any event, including a `schedule`.
- Pass CLI flags through `claude_args`, for example `claude_args: "--max-turns 5 --model claude-sonnet-5"`.
- For a plain-text `prompt`, Claude has no shell or GitHub API access until you grant tools with `--allowedTools` in `claude_args`.
- On issue and PR events, the person triggering the run needs write access to the repo, and bot actors are rejected unless listed in `allowed_bots`.

### 4. A nightly batch script

Run it from cron or a scheduled CI job. Each file gets its own small, capped run:

```bash
#!/usr/bin/env bash
# Needs ANTHROPIC_API_KEY: bare mode doesn't use your subscription login.
mkdir -p reports
for f in src/*.py; do
  claude --bare -p "Review $f for unclear error handling. Answer in at most 10 bullet points." \
    --allowedTools "Read" \
    --max-turns 5 \
    --max-budget-usd 0.50 \
    --no-session-persistence \
    --output-format json > "reports/$(basename "$f").json" \
    || echo "failed: $f" >&2
done
jq -s 'map(.total_cost_usd) | add' reports/*.json
```

The last line adds up `total_cost_usd` from every report. That figure is a client-side estimate and can differ from your bill.

## Cost and context in automation

- **Every run starts fresh.** A `-p` run knows only what you pass it, plus whatever it loads (CLAUDE.md, skills...) when you don't use `--bare`. Put the essentials in the prompt, and keep any CLAUDE.md the job loads short, since it is read on every run.
- **Keep the task small.** One file, one diff, one question. Pipe in exactly what's needed instead of asking Claude to explore.
- **Put a ceiling on it.** `--max-turns` stops runaway loops. `--max-budget-usd` stops on estimated spend, which can go past the cap, so leave headroom. In GitHub Actions, also set workflow timeouts and concurrency limits.
- **Pick model and effort on purpose.** Use `--model` and `--effort` for the job. A cheaper model is often enough for narrow checks.
- **Caching works per run.** With an API key, `-p` runs get a five-minute prompt cache by default. Turns inside one run reuse it, but a nightly job won't benefit from yesterday's cache. On a subscription within plan usage, the main conversation gets a one-hour cache.
- **Two bills in CI.** GitHub Actions uses runner minutes and tokens. With an OAuth token, runs use your Claude subscription instead of API billing.

## Safety

Automation removes the human who would normally say "wait, no". Make up for it:

- **Least privilege.** Grant only the tools the task needs. A review job needs `Read`, not `Bash` or `Edit`. Prefer narrow rules like `Bash(git diff *)` and `--permission-mode dontAsk` for locked-down runs.
- **Keep a human before the merge.** Give workflows only the GitHub permissions they need, and review Claude's changes before merging. Never let a CI job push or merge unreviewed.
- **Secrets stay in secrets.** Never commit API keys or OAuth tokens. Store them as CI secrets and reference them, e.g. `${{ secrets.ANTHROPIC_API_KEY }}`.
- **Treat PR content as untrusted.** Diffs, issue text and comments can carry instructions meant for Claude. The security docs advise against piping untrusted content straight in. Be extra strict on tools for jobs that read outside contributions. See [Prompt injection](/learn/prompt-injection).
- **Use `--bare` for repeatability.** It stops a repo's `.mcp.json` or project hooks from running in your pipeline without you noticing.

## Quick tips

- Start with `text` output and move to `json` once a script needs to parse it.
- Test the exact command locally before putting it in CI.
- Branch on the exit code, and check that `structured_output` is present.
- Name tools precisely: `Bash(git diff *)` beats `Bash`.
- Set `--max-turns` and `--max-budget-usd` on every scheduled job.

## Before you automate

- [ ] The task is small and focused, with everything it needs in the prompt or stdin
- [ ] Allowed tools are the minimum the task needs
- [ ] The run uses `--bare`, or you know which hooks, MCP servers and CLAUDE.md it loads
- [ ] Turns and budget are capped, and CI jobs have a timeout
- [ ] Credentials live in CI secrets, never in the repo
- [ ] Untrusted PR or issue text can't trigger write or shell access
- [ ] A human reviews every change before it merges

## Learn more

- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- [CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Permission modes](https://code.claude.com/docs/en/permission-modes)
- [Permissions](https://code.claude.com/docs/en/permissions)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
- [Manage costs](https://code.claude.com/docs/en/costs)
- [Security](https://code.claude.com/docs/en/security)
- [Everyday workflows](/learn/05-workflows)
