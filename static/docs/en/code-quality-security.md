# Better code and fewer vulnerabilities with Claude

> Treat Claude's code like a fast teammate's pull request: plan it, test it, scan it, then read the diff yourself.

## Why AI-written code still needs review

Claude writes code that looks finished. That's the risk: **plausible-but-wrong** code passes a quick glance. The usual problems:

- **Subtle logic bugs**: an off-by-one, a missing permission check, an error that's swallowed.
- **Outdated APIs**: a function that was deprecated or works differently in your version.
- **Packages that don't fit**: a suggested dependency that is misspelled, abandoned or doesn't exist. Check that every new package really exists, is the one you meant, and is maintained.
- **Secrets in code**: an API key pasted "just for testing" that ends up committed.
- **Insecure defaults**: CORS open to everyone, debug mode on, no rate limit, verbose errors.

The official docs are clear: you're responsible for reviewing proposed code and commands before you approve them. Even Claude's own review tools say a review with no findings doesn't mean the code is secure. Claude can also do much of the checking, if you ask.

## The helpers built into Claude Code

| Tool | What it does |
| --- | --- |
| `/security-review` | Checks the diff between your branch and origin's default branch for injection, auth issues, data exposure and more. Needs an `origin` remote. |
| `/code-review` | Reviews your branch for correctness bugs in a fresh subagent that never saw your conversation. `--fix` applies the findings. `/review` is an alias. |
| security-guidance plugin | Reviews Claude's own changes for vulnerabilities while it works, on each edit, turn and commit. |
| Plan mode | `Shift+Tab` or `/plan`: Claude reads and proposes, but doesn't edit until you approve. |
| `/rewind` | Rolls code and conversation back to a checkpoint. Also `Esc` twice. |
| Hooks | Run your formatter, linter or tests at fixed points, every time. |
| `/sandbox` | Limits which files and network hosts shell commands can reach. |

Install the plugin once with:

```text
/plugin install security-guidance@claude-plugins-official
```

On GitHub, `/install-github-app` sets up the Claude Code GitHub Action, and Team and Enterprise plans can turn on **Code Review**, which comments on every pull request. Neither approves or blocks a PR: merging stays your decision.

Checkpoints don't track files changed only by Bash, and they don't replace git. Commit often.

## A workflow that catches problems early

1. **Plan.** Start risky work in plan mode. Read the plan, especially anything touching auth, payments, file paths or user input.
2. **Write tests first (or with the code).** Ask for failing tests, including abuse cases. They're the check Claude runs against itself.
3. **Implement.** Approve the plan and let Claude write the code.
4. **Run tests and linters.** Ask for the exact command and its output, not just "all tests pass".
5. **Security review.** Run `/security-review`, then `/code-review` for correctness.
6. **Review the diff yourself.** Run `/diff` or open it in your editor.
7. **Commit.** Small commits, clear messages, on a branch.

More loop patterns in [Everyday workflows](/learn/05-workflows).

## Make the checks automatic with hooks

A line in CLAUDE.md works most of the time. A hook works every time. This `Stop` hook, from the official best practices, won't let Claude finish while the typecheck fails (exit code 2 sends the errors back to Claude):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "pnpm tsc --noEmit 1>&2 || exit 2" }
        ]
      }
    ]
  }
}
```

Swap in your own lint or test command. Use a `PostToolUse` hook with an `Edit|Write` matcher to run a formatter after every edit.

In CI, pipe a diff into headless mode. `--bare` skips the repo's hooks, plugins and CLAUDE.md, which the docs recommend for scripted runs:

```bash
git diff main | claude --bare -p "review this diff for security issues. list file:line, the risk and a fix. return nothing else."
```

## Prompt patterns

**Security review of a diff with specific threats:**

```text
Review the diff on this branch for security issues. Check specifically:
injection (SQL, shell, template), broken auth or missing authorization checks,
hard-coded secrets, missing input validation, path traversal, SSRF, XSS,
unsafe deserialization, and risky new dependencies.
For each finding: file:line, how it could be exploited, severity, and a fix.
Skip style issues. Say "no findings" for a category if you checked it.
```

**Explain risky code before you accept it:**

```text
Explain what src/api/upload.ts does with user input, step by step.
Where does untrusted data enter, where is it validated, and where does it
reach the filesystem, a database or a shell? What would an attacker try first?
```

**Tests for edge cases and abuse cases:**

```text
Write tests for the password reset flow before changing it. Cover:
empty and very long input, unicode, expired and reused tokens,
another user's token, many requests in a row, and missing fields.
Run them and show me which fail.
```

**Check new dependencies:**

```text
List every dependency this change adds. For each one, check the registry:
does it exist under exactly this name, who maintains it, when was the last
release, and is there a well-known alternative we already use?
Flag anything new, unmaintained or with a name close to a popular package.
```

## OWASP-style checklist

| Risk | What to check | Ask Claude |
| --- | --- | --- |
| Injection | Queries and shell commands built from strings | "Find any query or command built with user input." |
| Broken authentication | Sessions, tokens, password handling | "How are sessions created, expired and revoked?" |
| Secrets and data exposure | Keys in code, logs, error messages | "Search the diff for secrets and data we log." |
| Access control | Every endpoint checks who the user is and what they own | "List endpoints that skip an ownership check." |
| Security misconfiguration | CORS, debug flags, default passwords, headers | "Which settings are unsafe in production?" |
| XSS | Raw HTML, `innerHTML`, unescaped templates | "Where does user content reach the page unescaped?" |
| Insecure deserialization | `pickle`, `eval`, untrusted YAML or JSON into objects | "Where do we turn untrusted data into objects?" |
| Vulnerable dependencies | Old versions, abandoned or unknown packages | "Which dependencies are outdated or unmaintained?" |
| Logging and monitoring | Failed logins and errors are logged, without secrets | "What security events would we miss today?" |
| SSRF | Server fetching URLs that users control | "Where can a user make the server request a URL?" |

## Team habits

**Put the rules in CLAUDE.md**, short and concrete:

```markdown
# Security and code style
- Validate all request input with the schemas in src/schemas/
- Use parameterized queries only, never string concatenation
- Never log tokens, passwords or full request bodies
- Secrets come from environment variables, never from code
- New dependencies need a reason in the PR description
```

CLAUDE.md is guidance, and Claude can decide a line doesn't apply. Things that must never happen belong in **deny rules** or hooks. Deny rules hold in every permission mode:

```json
{
  "permissions": {
    "ask": ["Bash(git push *)"],
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
  }
}
```

- **Commit `.claude/settings.json`** so the whole team shares the same rules and hooks.
- **Protect your main branch** with required reviews and passing checks. Never let an agent push to main unreviewed.
- **Keep secrets in a secret store** (GitHub Secrets for workflows) and give CI jobs minimal permissions.
- **Keep dependencies updated** and review update PRs like any other change.

To lock down the environment, read [Secure your Claude Code setup](/learn/secure-setup), and for untrusted content, [Prompt injection: work safely with outside content](/learn/prompt-injection).

## Quick tips

- Name the threats you care about. "Check for security issues" gets a vaguer review than a list.
- Add "skip style" to review prompts to cut noise.
- Ask for evidence: the command, its output, the failing test.
- Don't fix every finding blindly. Ask Claude to show how each one could be exploited.

## Before you merge

- [ ] I read the plan before Claude edited anything risky
- [ ] Tests cover the happy path, edge cases and abuse cases
- [ ] Tests, linter and typecheck pass, and I saw the output
- [ ] `/security-review` and `/code-review` ran, and I handled the findings
- [ ] New dependencies exist, are maintained and are really needed
- [ ] No secrets, debug flags or open defaults in the diff
- [ ] I read the whole diff myself
- [ ] The change goes through a pull request, not straight to main

## Learn more

- [Security](https://code.claude.com/docs/en/security)
- [Review locally with /code-review](https://code.claude.com/docs/en/code-review-local)
- [Catch security issues as Claude writes code](https://code.claude.com/docs/en/security-guidance)
- [Code Review](https://code.claude.com/docs/en/code-review)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Best practices](https://code.claude.com/docs/en/best-practices)
- [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide)
- [Configure permissions](https://code.claude.com/docs/en/permissions)
- [Checkpointing](https://code.claude.com/docs/en/checkpointing)
