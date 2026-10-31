# Reading this dashboard

> A tour of each screen, what the numbers mean, and how to turn them into better habits.

## Where the data comes from

Claude Code saves each session as a JSONL transcript under `~/.claude/projects/`. This dashboard reads those files locally.

**Important:** the numbers here are **estimates**. They come from the token usage fields in the transcript and from character counts of each message. The transcript format is internal to Claude Code and can change between versions. For the exact picture of a live session, run `/context` inside Claude Code.

## Sessions list

One row per local session:

- **Context used vs window**: how full the context was at the last request, compared with the model's window size.
- **Prompts and compactions**: how many messages you sent and how often the history was summarized. Token totals (input, output, cache read and write) are on each session's detail page.
- **Last activity**: when the session was last used.

Open the sessions with the fullest context first: they have the most to teach.

## Session detail: the breakdown

A bar and a table split the context into parts, similar to `/context`:

| Part | What it means |
| --- | --- |
| System prompt, tools & memory | The fixed part: system prompt, tool definitions (built-in and MCP) and memory files. Calculated as the total minus all messages, so tools added mid-session show up here too. |
| Your messages | What you typed. |
| Claude's replies | What Claude wrote back. |
| Thinking | Claude's reasoning tokens. |
| Tool calls | Claude's requests to read files, run commands, and so on. |
| Tool results | What those tools returned. The **Tools used** table splits it per tool (Read, Bash, MCP…). |
| Autocompact buffer | Room kept free so auto-compaction can run before the window is full. |
| Free space | What's left. |

If **tool results** dominate, Claude read big files or got long command outputs. If **system prompt, tools & memory** is large, look at your CLAUDE.md, MCP servers and skills.

## Biggest items

A list of the largest single tool results and messages. This is often the fastest win: one huge log or file read can take more space than the rest of the chat. Next time, ask for a filtered output or send that work to a subagent.

## Timeline

A chart of context size per turn. Look for:

- **Steep jumps**: one turn added a lot, usually a big tool result.
- **Compaction markers**: points where the history was summarized and context dropped.
- **Slow steady growth**: a long session mixing several tasks. Consider `/clear` between tasks.

## Cache read vs cache write

Claude Code re-sends the conversation on every request, and prompt caching reuses what was already processed.

- **Cache read**: tokens served from cache, billed at a lower rate.
- **Cache write**: tokens written to the cache.

A high read-to-write ratio means caching is working. If writes stay high turn after turn, something keeps changing the start of the prompt, such as switching models mid-session or long breaks after the cache expires.

## Recommendations

The dashboard shows simple rule-based tips, like "large tool results: consider a subagent" or "context near the limit: try `/compact` with a focus". They are suggestions based on the estimates above, not official diagnostics.

## Quick tips

- Start with the Biggest items list.
- Compare system prompt, tools & memory across sessions to spot a heavy setup.
- Use the timeline to find the turn where things went off.
- Confirm anything important with `/context` and `/usage` in Claude Code.

## Learn more

- [Explore the context window](https://code.claude.com/docs/en/context-window)
- [Manage sessions](https://code.claude.com/docs/en/sessions)
- [Prompt caching](https://code.claude.com/docs/en/prompt-caching)
- [Manage costs effectively](https://code.claude.com/docs/en/costs)
- [Model configuration](https://code.claude.com/docs/en/model-config)
