# Plan before you build: plan mode

> Let Claude explore and propose a plan first, agree on the approach, then let it edit.

## What plan mode is

Plan mode tells Claude to research and propose changes without making them. In plan mode Claude:

- **Can** read files, search the code and run shell commands to explore.
- **Can** write a plan and ask you questions.
- **Can't** edit your source files until you approve the plan.

Shell commands still go through your permission setup. If auto mode is available, its classifier reviews commands during planning by default. If it isn't, any command outside the built-in read-only set asks for your approval first.

One exception: if your terminal session was started with bypass permissions available, plan mode's blocks are not enforced. Claude is still told not to edit, but nothing stops it. Keep that in mind before you rely on plan mode as a safety net.

When Claude needs to dig through the codebase while planning, it can hand the research to the built-in **Plan** subagent. That subagent reads files in its own context window, so the exploration output stays out of your main conversation.

## Enter, leave and start in plan mode

| How | What it does |
| --- | --- |
| `Shift+Tab` | Cycles permission modes until the status bar shows `⏸ plan mode on` |
| `/plan <your prompt>` | Runs that one prompt in plan mode |
| `claude --permission-mode plan` | Starts the session in plan mode |
| `"defaultMode": "plan"` in `.claude/settings.json` | Makes plan mode the default for this project's terminal sessions |
| `Shift+Tab` again | Leaves plan mode without approving a plan |

The setting goes under `permissions`:

```json
{
  "permissions": {
    "defaultMode": "plan"
  }
}
```

In the VS Code extension, conversations don't read the starting mode from project settings. Set `claudeCode.initialPermissionMode` to `plan` in your VS Code user settings instead.

## Review, edit and approve

When the plan is ready, Claude shows it and asks how to proceed:

- **Yes, and use auto mode**: approve and let Claude work without routine prompts. If auto mode isn't available, this reads **Yes, auto-accept edits**.
- **Yes, manually approve edits**: approve, and review each edit yourself.
- **No, keep planning**: stay in plan mode and tell Claude what to change.

Press `Ctrl+G` to open the plan in your text editor and change it directly before Claude starts. If the `showClearContextOnPlanAccept` setting is on, you also get an option that approves the plan and clears the planning context.

Approving exits plan mode. To plan again, use `Shift+Tab` or `/plan`.

## When to use it, and when not

Plan mode is for changes you want to review before they touch disk. In practice it pays off when:

- The change spans several files or modules.
- You don't know the code well yet.
- The refactor is risky or hard to undo.
- The requirements are fuzzy and you want to see Claude's understanding first.

Skip it for a typo, a one-line fix or a rename you could describe in one sentence. The plan would cost more than the change.

## Why it saves context and money

- **Explore once.** Claude reads the relevant code during planning, ideally through the Plan subagent, instead of rediscovering it during every attempt.
- **Agree before you pay for code.** Fixing a wrong assumption in a plan costs a short reply. Fixing it after Claude edited ten files costs a rewrite, plus the failed attempt that stays in the history and is re-sent every turn.
- **Fewer corrections.** After two failed corrections, the advice is to `/clear` and start over. A good plan makes that less likely.
- **Cache-friendly.** Plan mode adds its instructions as messages, so entering and leaving it keeps your prompt cache. The exception is the `opusplan` model setting: it uses Opus in plan mode and Sonnet for execution, so each toggle is a model switch and starts a fresh cache. See [Change mid-session or start fresh?](/learn/change-or-restart).

## A worked example

You want to add rate limiting to an API you didn't write. Enter plan mode and ask:

```text
/plan Add per-user rate limiting to the public API routes in src/api/.
Limit: 100 requests per minute, return 429 with a Retry-After header.
Find how auth and middleware work today before proposing anything.
Don't touch the admin routes. Tell me how you'll test it.
```

A good plan is short, specific and testable:

```text
1. Add src/api/middleware/rateLimit.ts: in-memory sliding window keyed by user id.
2. Register it in src/api/router.ts after authMiddleware, public routes only.
3. Return 429 + Retry-After when over the limit.
4. Tests in tests/api/rateLimit.test.ts: under limit, over limit, reset, admin unaffected.
5. Run npm test.
Open question: in-memory won't work with several servers. Redis later?
```

Now push back where it's wrong. Pick **No, keep planning** and reply, for example:

```text
We run three instances, so use the existing Redis client in src/lib/redis.ts.
Also add the limit to config instead of hard-coding 100.
```

When the plan matches what you'd do, approve it.

## Plan, implement, test, commit

1. **Plan** in plan mode until you agree with the approach.
2. **Implement**: approve, and watch the first minute. `Esc` stops Claude if it drifts.
3. **Test**: the plan should name the check to run. Ask Claude to run it and fix failures.
4. **Commit** once the tests pass, so you have a clean point to return to.

Checkpoints make this safer. Every prompt creates one, and `/rewind` (or `Esc` twice on an empty prompt) restores code, conversation or both. Checkpoints only track edits from Claude's file tools, not Bash commands, so commit too. More in [Everyday workflows](/learn/05-workflows).

For a big plan, ask Claude to save it to a spec file and build it in a fresh session.

## Common mistakes

| Mistake | Why it hurts | Better |
| --- | --- | --- |
| Approving a plan you skimmed | Wrong assumptions turn into wrong code across many files | Read it, and use **No, keep planning** or `Ctrl+G` to fix it |
| A vague request like "add rate limiting" | Claude guesses the scope and the plan is generic | Name files, limits, constraints and how to test |
| Planning a one-line fix | Exploration costs more than the fix | Just ask for the change |
| Toggling plan mode often with `opusplan` | Each toggle is a model switch and a cache miss | Plan once, then implement |
| Treating plan mode as a hard lock with bypass permissions on | Blocks aren't enforced there | Use normal permissions when the lock matters |

## Plan mode checklist

- [ ] The task is bigger than a one-sentence fix
- [ ] My prompt names the goal, the files and the limits
- [ ] The plan lists files, steps and a test
- [ ] I pushed back on anything wrong before approving
- [ ] I chose auto or manual edits on purpose
- [ ] Tests pass, then I commit

## Quick tips

- `/plan` for one prompt, `Shift+Tab` to stay in plan mode.
- `Ctrl+G` edits the plan in your editor.
- Ask Claude to list open questions at the end of the plan.
- More on subagents in [MCP, skills and subagents](/learn/04-mcp-skills-subagents).

## Learn more

- [Plan mode in permission modes](https://code.claude.com/docs/en/permission-modes)
- [Common workflows](https://code.claude.com/docs/en/common-workflows)
- [Best practices](https://code.claude.com/docs/en/best-practices)
- [Interactive mode](https://code.claude.com/docs/en/interactive-mode)
- [Subagents](https://code.claude.com/docs/en/sub-agents)
- [Model configuration](https://code.claude.com/docs/en/model-config)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
- [Checkpointing](https://code.claude.com/docs/en/checkpointing)
