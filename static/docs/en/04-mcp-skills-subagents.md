# MCP, skills and subagents

> MCP connects Claude to outside tools, skills teach it how to do things, and subagents do work in a separate context.

## The short version

| Feature | Use it for | Context cost |
| --- | --- | --- |
| MCP server | Reaching an outside system: issue tracker, database, browser | Low until a tool is used (names load first, schemas on demand) |
| Skill | Reusable instructions, checklists, reference docs | Low: only descriptions load until the skill is used |
| Subagent | Tasks that read many files or produce lots of output | Isolated: runs in its own window, only a summary comes back |

## MCP: connect to tools

Connect an MCP server when you keep copying data into chat from another tool. Claude can then read and act on that system directly.

- Add a server with `claude mcp add`.
- Run `/mcp` to see status and disable servers you don't need.
- Thanks to **tool search**, only tool names and server instructions load at the start. Full tool definitions load when Claude needs one.
- If a good CLI exists (`gh`, `aws`, `gcloud`), it is often even more context-efficient, because it adds no per-tool listing.

## Skills: knowledge on demand

A skill is a folder with a `SKILL.md` file. It has a short `description` and the full instructions.

- At session start, Claude sees only the **description**.
- The **full content** loads when you type `/skill-name` or when Claude decides it is relevant.
- Once loaded, it stays in the conversation.

Where they live:

- Personal: `~/.claude/skills/<name>/SKILL.md`
- Project: `.claude/skills/<name>/SKILL.md`

Custom commands are now skills. A file in `.claude/commands/deploy.md` still works and creates `/deploy`.

Tip: for skills you only run by hand, add `disable-model-invocation: true` to the frontmatter. Then even the description stays out of context until you invoke it.

## Subagents: keep your main context clean

A subagent is a helper with its own context window, its own system prompt and its own tool access. It does the heavy reading and returns a summary.

```
Use a subagent to run the test suite and report only the failing tests with their error messages
```

- Claude already uses the built-in **Explore** agent for broad codebase searches.
- Custom subagents are markdown files in `.claude/agents/` (project) or `~/.claude/agents/` (personal). The easiest way to make one is to ask Claude to write it.
- Subagents still use tokens and count toward your usage. For simple jobs, you can set a cheaper model like `haiku` in the subagent's config.

## How to choose

- Need data from Slack, a database or a browser? **MCP**.
- Pasting the same instructions again and again? **Skill**.
- About to read dozens of files or run noisy commands? **Subagent**.
- They combine: a subagent can preload skills, and a skill can use MCP tools.

## Quick tips

- Run `/context` to see what MCP tools and skills cost in your session.
- Keep skill and subagent descriptions short: they load every session.
- Move long CLAUDE.md sections into skills.
- Ask for a subagent whenever output would be big and you only need the conclusion.

## Learn more

- [Extend Claude Code](https://code.claude.com/docs/en/features-overview)
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
