// Reads one Claude Code session transcript (.jsonl) and turns it into
// numbers the dashboard can show.
//
// How the numbers work:
// - Every Claude reply records real token usage from the API. The context
//   size of a request = input + cache write + cache read tokens. That total
//   is measured, not guessed.
// - The transcript does not say *what* those tokens are. We estimate each
//   piece from its text length (about 4 characters per token), then scale the
//   estimates so they add up to the measured total.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHARS_PER_TOKEN = 4;
const IMAGE_TOKENS = 1600; // rough cost of one pasted image
// Plain text is ~3.4 characters per token (checked against /context), so
// scale the 4-chars estimate up a bit.
const PROSE_FACTOR = 1.18;

// Attachment types that are bookkeeping only and never reach the model.
const SILENT_ATTACHMENTS = new Set([
  'prompt_snapshot', 'deferred_tools_record', 'credential_org',
  'remote_session_change', 'hook_success',
]);

function est(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / CHARS_PER_TOKEN);
}

function blockText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c) => {
      if (typeof c === 'string') return c;
      if (c.type === 'text') return c.text || '';
      if (c.type === 'image') return '';
      return JSON.stringify(c);
    }).join('\n');
  }
  return JSON.stringify(content);
}

function countImages(content) {
  if (!Array.isArray(content)) return 0;
  return content.filter((c) => c && c.type === 'image').length;
}

function attachmentText(a) {
  switch (a.type) {
    case 'skill_listing': return a.content || '';
    case 'mcp_instructions_delta': return (a.addedBlocks || []).join('\n');
    case 'deferred_tools_delta': return (a.addedNames || []).join('\n');
    case 'agent_listing_delta': return (a.addedLines || []).join('\n');
    default: {
      if (typeof a.content === 'string') return a.content;
      if (typeof a.text === 'string') return a.text;
      const copy = { ...a };
      delete copy.type;
      return JSON.stringify(copy);
    }
  }
}

function attachmentCategory(type) {
  if (type === 'skill_listing') return 'skills';
  if (type === 'mcp_instructions_delta') return 'mcp_instructions';
  if (type === 'deferred_tools_delta') return 'deferred_tools';
  if (type === 'agent_listing_delta') return 'agents';
  if (type && type.startsWith('hook')) return 'hooks';
  return 'reminders';
}

// Short label for a tool call, e.g. the file it read or the command it ran.
function toolLabel(name, input) {
  if (!input || typeof input !== 'object') return '';
  const pick = input.file_path || input.path || input.notebook_path || input.command ||
    input.pattern || input.url || input.query || input.description || input.prompt || input.skill;
  if (!pick) return '';
  const s = String(pick).replace(/\s+/g, ' ').trim();
  return s.length > 90 ? s.slice(0, 87) + '…' : s;
}

function mcpServer(name) {
  if (!name || !name.startsWith('mcp__')) return null;
  return name.split('__')[1] || 'mcp';
}

function readLines(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* last line may still be writing */ }
  }
  return out;
}

function usageTotal(u) {
  if (!u) return 0;
  return (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
}

/**
 * Parse a session file. `full` = include the detailed breakdown.
 */
function parseSession(file, { full = true } = {}) {
  const rows = readLines(file);
  const s = {
    file,
    id: path.basename(file, '.jsonl'),
    title: null,
    firstPrompt: null,
    cwd: null,
    gitBranch: null,
    model: null,
    version: null,
    entrypoint: null,
    start: null,
    end: null,
    userPrompts: 0,
    requests: [], // one per API call
    compactions: [],
    totals: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, thinking: 0 },
    systemPromptChars: 0,
  };

  // Items that sit in the context window, in order. Reset on compaction.
  let items = [];
  const toolNames = new Map(); // tool_use_id -> {name, label}
  // MCP servers seen in this session (from tool listings in the transcript).
  const mcp = new Map(); // server -> { name, tools:Set, loaded:Map(tool -> tokens), instructionsTokens }
  let mcpIssues = []; // servers that are pending, need sign-in, or failed
  const srv = (name) => {
    if (!mcp.has(name)) mcp.set(name, { name, tools: new Set(), loaded: new Map(), instructionsTokens: 0 });
    return mcp.get(name);
  };
  const reqById = new Map();
  let lastAssistantId = null;

  const pushItem = (it) => {
    it.tokens = it.tokens || 0;
    it.turn = s.requests.length; // requests made before this item
    items.push(it);
  };

  for (const d of rows) {
    if (d.isSidechain) continue;
    if (d.timestamp) {
      if (!s.start || d.timestamp < s.start) s.start = d.timestamp;
      if (!s.end || d.timestamp > s.end) s.end = d.timestamp;
    }
    if (d.cwd && !s.cwd) s.cwd = d.cwd;
    if (d.gitBranch) s.gitBranch = d.gitBranch;
    if (d.version) s.version = d.version;
    if (d.entrypoint) s.entrypoint = d.entrypoint;

    switch (d.type) {
      case 'ai-title':
        if (d.aiTitle) s.title = d.aiTitle;
        break;
      case 'summary':
        if (d.summary && !s.title) s.title = d.summary;
        break;
      case 'system':
        if (d.subtype === 'compact_boundary') {
          const meta = d.compactMetadata || {};
          s.compactions.push({
            atRequest: s.requests.length,
            time: d.timestamp,
            trigger: meta.trigger || null,
            preTokens: meta.preTokens || null,
          });
          items = [];
        }
        break;
      case 'attachment': {
        const a = d.attachment || {};
        if (a.type === 'prompt_snapshot') {
          s.systemPromptChars = blockText(a.systemPrompt).length;
          break;
        }
        if (a.type === 'deferred_tools_delta') {
          for (const n of a.addedNames || []) { const sv = mcpServer(n); if (sv) srv(sv).tools.add(n); }
          for (const n of a.removedNames || []) { const sv = mcpServer(n); if (sv && mcp.has(sv)) { mcp.get(sv).tools.delete(n); mcp.get(sv).loaded.delete(n); } }
          for (const def of a.surfacedDefinitions || []) {
            const sv = mcpServer(def.name);
            if (sv) srv(sv).loaded.set(def.name, Math.round(est(JSON.stringify(def.definition || def)) * PROSE_FACTOR));
          }
          // Each delta carries the full current list of servers that aren't connected.
          if (a.pendingMcpServers || a.needsAuthMcpServers || a.failedMcpServers) {
            mcpIssues = [
              ...(a.pendingMcpServers || []).map((n) => ({ name: String(n), status: 'pending' })),
              ...(a.needsAuthMcpServers || []).map((n) => ({ name: String(n), status: 'needs_auth' })),
              ...(a.failedMcpServers || []).map((f) => ({ name: String(f.name || f), status: 'failed', error: f.errorCode || null })),
            ];
          }
        }
        if (a.type === 'mcp_instructions_delta') {
          (a.addedNames || []).forEach((n, i) => { srv(n).instructionsTokens = Math.round(est((a.addedBlocks || [])[i] || '') * PROSE_FACTOR); });
        }
        if (SILENT_ATTACHMENTS.has(a.type)) break;
        const text = attachmentText(a);
        if (!text) break;
        pushItem({ cat: attachmentCategory(a.type), kind: a.type, label: '', tokens: est(text) });
        break;
      }
      case 'user': {
        const m = d.message || {};
        const c = m.content;
        if (d.isCompactSummary) {
          pushItem({ cat: 'compact_summary', kind: 'summary', label: '', tokens: est(blockText(c)) });
          break;
        }
        if (typeof c === 'string') {
          const isCmd = /^<(command|local-command)/.test(c);
          const cat = d.isMeta || isCmd ? 'reminders' : 'user';
          if (cat === 'user') {
            s.userPrompts++;
            if (!s.firstPrompt) s.firstPrompt = c.slice(0, 200);
          }
          pushItem({ cat, kind: 'text', label: c.replace(/\s+/g, ' ').slice(0, 90), tokens: est(c) });
          break;
        }
        if (!Array.isArray(c)) break;
        for (const b of c) {
          if (b.type === 'tool_result') {
            const t = toolNames.get(b.tool_use_id) || { name: 'unknown', label: '' };
            const tokens = est(blockText(b.content)) + countImages(b.content) * IMAGE_TOKENS;
            pushItem({ cat: 'tool_results', kind: 'tool_result', tool: t.name, label: t.label, tokens, error: !!b.is_error });
          } else if (b.type === 'text') {
            const meta = d.isMeta || /^<(system-reminder|command)/.test(b.text || '');
            if (!meta) {
              s.userPrompts++;
              if (!s.firstPrompt) s.firstPrompt = (b.text || '').slice(0, 200);
            }
            pushItem({ cat: meta ? 'reminders' : 'user', kind: 'text', label: (b.text || '').replace(/\s+/g, ' ').slice(0, 90), tokens: est(b.text) });
          } else if (b.type === 'image') {
            pushItem({ cat: 'user', kind: 'image', label: 'Image', tokens: IMAGE_TOKENS });
          }
        }
        break;
      }
      case 'assistant': {
        const m = d.message || {};
        if (m.model === '<synthetic>') break;
        const id = m.id || d.requestId || d.uuid;
        let req = reqById.get(id);
        if (!req) {
          req = { id, time: d.timestamp, model: m.model, usage: m.usage || {} };
          reqById.set(id, req);
          s.requests.push(req);
        } else if (m.usage) {
          req.usage = m.usage; // later lines carry the final usage
        }
        if (m.model) s.model = m.model;
        lastAssistantId = id;
        for (const b of m.content || []) {
          if (b.type === 'text') {
            pushItem({ cat: 'assistant', kind: 'text', req: id, label: (b.text || '').replace(/\s+/g, ' ').slice(0, 90), tokens: est(b.text) });
          } else if (b.type === 'thinking' || b.type === 'redacted_thinking') {
            pushItem({ cat: 'thinking', kind: 'thinking', req: id, label: '', tokens: est(b.thinking || b.data) });
          } else if (b.type === 'tool_use') {
            const label = toolLabel(b.name, b.input);
            toolNames.set(b.id, { name: b.name, label });
            pushItem({ cat: 'tool_calls', kind: 'tool_use', req: id, tool: b.name, label, tokens: est(JSON.stringify(b.input || {})) + 10 });
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // Token totals (each request counted once).
  for (const r of s.requests) {
    const u = r.usage || {};
    s.totals.input += u.input_tokens || 0;
    s.totals.cacheWrite += u.cache_creation_input_tokens || 0;
    s.totals.cacheRead += u.cache_read_input_tokens || 0;
    s.totals.output += u.output_tokens || 0;
    s.totals.thinking += (u.output_tokens_details && u.output_tokens_details.thinking_tokens) || 0;
  }

  const last = s.requests[s.requests.length - 1];
  const first = s.requests[0];
  const lastIn = last ? usageTotal(last.usage) : 0;
  const lastOut = last ? (last.usage.output_tokens || 0) : 0;
  const peak = s.requests.reduce((m, r) => Math.max(m, usageTotal(r.usage)), 0);

  const summary = {
    id: s.id,
    file: s.file,
    title: s.title || (s.firstPrompt ? s.firstPrompt.replace(/\s+/g, ' ').slice(0, 80) : null),
    firstPrompt: s.firstPrompt,
    project: s.cwd,
    gitBranch: s.gitBranch,
    model: s.model,
    version: s.version,
    entrypoint: s.entrypoint,
    start: s.start,
    end: s.end,
    userPrompts: s.userPrompts,
    requests: s.requests.length,
    compactions: s.compactions.length,
    // Same formula as Claude Code's status line: input side of the latest request.
    contextTokens: lastIn,
    lastOutput: lastOut,
    peakTokens: peak,
    totals: s.totals,
    cacheHitRate: (() => {
      const all = s.totals.input + s.totals.cacheWrite + s.totals.cacheRead;
      return all ? s.totals.cacheRead / all : 0;
    })(),
  };

  if (!full) return summary;

  // Only keep what the latest request actually carried: the newest reply and
  // anything after it isn't part of the measured total yet.
  items = items.filter((i) => i.turn < s.requests.length);

  // Claude's own output is measured per request (output_tokens, incl. thinking).
  // Split it across that reply's blocks; thinking gets its exact share.
  const byReq = new Map();
  for (const it of items) {
    if (!it.req) continue;
    if (!byReq.has(it.req)) byReq.set(it.req, []);
    byReq.get(it.req).push(it);
  }
  for (const r of s.requests) {
    const list = byReq.get(r.id);
    if (!list) continue;
    const u = r.usage || {};
    const out = u.output_tokens || 0;
    const think = Math.min(out, (u.output_tokens_details && u.output_tokens_details.thinking_tokens) || 0);
    const thinkItems = list.filter((i) => i.cat === 'thinking');
    const other = list.filter((i) => i.cat !== 'thinking');
    if (think && !thinkItems.length) {
      const t = { cat: 'thinking', kind: 'thinking', req: r.id, label: '', tokens: 0, turn: other[0] ? other[0].turn : 0 };
      items.push(t); thinkItems.push(t);
    }
    const share = (arr, total) => {
      const sum = arr.reduce((a, i) => a + i.tokens, 0);
      for (const i of arr) { i.tokens = sum ? Math.round(total * i.tokens / sum) : Math.round(total / arr.length); i.measured = true; }
    };
    if (thinkItems.length) share(thinkItems, think);
    if (other.length) share(other, out - (thinkItems.length ? think : 0));
  }

  // Everything else (your messages, tool results, reminders) is estimated
  // from text length. We calibrate that estimate per session: between two
  // requests the context grows by the previous reply (measured) plus the new
  // items (estimated), so (growth - reply) / estimate = correction factor.
  // Plain text (prompts, listings, reminders) uses a fixed rate; tool output
  // (code, JSON, logs) is denser and gets the calibrated factor.
  for (const it of items) if (!it.measured && it.cat !== 'tool_results') it.tokens = Math.round(it.tokens * PROSE_FACTOR);
  const toolByTurn = new Map();
  const proseByTurn = new Map();
  for (const it of items) {
    if (it.measured) continue;
    const m = it.cat === 'tool_results' ? toolByTurn : proseByTurn;
    m.set(it.turn, (m.get(it.turn) || 0) + it.tokens);
  }
  const ratios = [];
  for (let j = 1; j < s.requests.length; j++) {
    const dr = toolByTurn.get(j) || 0;
    if (dr < 150) continue;
    const grow = usageTotal(s.requests[j].usage) - usageTotal(s.requests[j - 1].usage);
    if (grow <= 0) continue; // compaction or cache reset
    ratios.push((grow - (s.requests[j - 1].usage.output_tokens || 0) - (proseByTurn.get(j) || 0)) / dr);
  }
  ratios.sort((x, y) => x - y);
  let scale = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 1.5;
  scale = Math.min(3, Math.max(0.7, scale));
  for (const it of items) if (!it.measured && it.cat === 'tool_results') it.tokens = Math.round(it.tokens * scale);

  // Fixed overhead = measured total minus all messages. That's the system
  // prompt, tool definitions (built-in + MCP) and memory files like CLAUDE.md.
  const msgSum = items.reduce((a, i) => a + i.tokens, 0);
  let fixed = summary.contextTokens - msgSum;
  if (fixed < 0) {
    // Estimates overshot: shrink the estimated items to fit.
    const guessed = items.filter((i) => !i.measured);
    const guessedSum = guessed.reduce((a, i) => a + i.tokens, 0);
    const k = guessedSum ? Math.max(0, guessedSum + fixed) / guessedSum : 1;
    for (const it of guessed) it.tokens = Math.round(it.tokens * k);
    fixed = 0;
  }
  // How big the overhead was on the very first request (fresh sessions only).
  let fixedAtStart = null;
  if (first && !s.compactions.length) {
    fixedAtStart = Math.max(0, Math.round(usageTotal(first.usage) - (proseByTurn.get(0) || 0) - (toolByTurn.get(0) || 0)));
  }
  const sysPrompt = Math.min(fixed, est('x'.repeat(s.systemPromptChars)));
  const mcpLoaded = [...mcp.values()].reduce((a, m) => a + [...m.loaded.values()].reduce((b, v) => b + v, 0), 0);
  const mcpTools = Math.min(mcpLoaded, fixed - sysPrompt);
  const fixedParts = {};
  if (sysPrompt) fixedParts.system_prompt = sysPrompt;
  if (mcpTools) fixedParts.mcp_tools = mcpTools;
  const rest = fixed - sysPrompt - mcpTools;
  if (sysPrompt || mcpTools) fixedParts.tools_other = rest;
  else fixedParts.fixed_overhead = fixed;

  const cats = {};
  for (const it of items) cats[it.cat] = (cats[it.cat] || 0) + it.tokens;

  // Per-tool usage.
  const tools = {};
  for (const it of items) {
    if (!it.tool) continue;
    const t = tools[it.tool] || (tools[it.tool] = { name: it.tool, server: mcpServer(it.tool), calls: 0, callTokens: 0, resultTokens: 0, errors: 0 });
    if (it.kind === 'tool_use') { t.calls++; t.callTokens += it.tokens; }
    else { t.resultTokens += it.tokens; if (it.error) t.errors++; }
  }

  // Largest single items in context.
  const biggest = items
    .filter((i) => i.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 12)
    .map(({ cat, kind, tool, label, tokens, turn }) => ({ cat, kind, tool, label, tokens, turn }));

  // Extra signals for the recommendations.
  const models = [...new Set(s.requests.map((r) => r.model).filter(Boolean))];
  const reads = items.filter((i) => i.kind === 'tool_use' && ['Read', 'Grep', 'Glob'].includes(i.tool));
  const readCount = {};
  for (const r of reads) if (r.tool === 'Read' && r.label) readCount[r.label] = (readCount[r.label] || 0) + 1;
  const repeated = Object.entries(readCount).sort((a, b) => b[1] - a[1])[0] || null;
  let idleRebuilds = 0;
  for (let j = 1; j < s.requests.length; j++) {
    const gap = new Date(s.requests[j].time) - new Date(s.requests[j - 1].time);
    if (gap > 5 * 60 * 1000 && (s.requests[j].usage.cache_creation_input_tokens || 0) > 20000) idleRebuilds++;
  }
  const mcpServers = [...mcp.values()].map((m) => {
    const t = Object.values(tools).filter((x) => x.server === m.name);
    return {
      name: m.name,
      tools: m.tools.size,
      loadedTools: m.loaded.size,
      loadedTokens: [...m.loaded.values()].reduce((a, v) => a + v, 0),
      instructionsTokens: m.instructionsTokens,
      calls: t.reduce((a, x) => a + x.calls, 0),
      contextTokens: t.reduce((a, x) => a + x.callTokens + x.resultTokens, 0),
    };
  }).sort((a, b) => (b.loadedTokens + b.instructionsTokens + b.contextTokens) - (a.loadedTokens + a.instructionsTokens + a.contextTokens));

  const signals = {
    models,
    fileReads: reads.length,
    mostReadFile: repeated && repeated[1] >= 3 ? { path: repeated[0], count: repeated[1] } : null,
    idleRebuilds,
    largestToolResult: items.filter((i) => i.cat === 'tool_results').reduce((m, i) => Math.max(m, i.tokens), 0),
  };

  const timeline = s.requests.map((r, i) => ({
    i,
    time: r.time,
    total: usageTotal(r.usage),
    cacheRead: r.usage.cache_read_input_tokens || 0,
    cacheWrite: r.usage.cache_creation_input_tokens || 0,
    input: r.usage.input_tokens || 0,
    output: r.usage.output_tokens || 0,
  }));

  return {
    ...summary,
    breakdown: { fixed: fixedParts, fixedTotal: fixed, fixedAtStart, categories: cats, scale: Number(scale.toFixed(2)), estimated: true },
    tools: Object.values(tools).sort((a, b) => (b.resultTokens + b.callTokens) - (a.resultTokens + a.callTokens)),
    biggest,
    timeline,
    compactionEvents: s.compactions,
    signals,
    mcp: { servers: mcpServers, issues: mcpIssues, loadedTokens: mcpLoaded },
    itemCount: items.length,
  };
}

/** Subagent transcripts live in <session-id>/subagents/agent-*.jsonl */
function parseSubagents(sessionFile) {
  const dir = path.join(path.dirname(sessionFile), path.basename(sessionFile, '.jsonl'), 'subagents');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')); } catch { return []; }
  return files.map((f) => {
    const p = path.join(dir, f);
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(p.replace(/\.jsonl$/, '.meta.json'), 'utf8')); } catch { /* optional */ }
    // Subagent rows are all marked as sidechain; read them as a normal session.
    const rows = readLines(p).map((r) => ({ ...r, isSidechain: false }));
    const tmp = { requests: 0, peak: 0, output: 0, toolCalls: 0, start: null, end: null };
    const seen = new Set();
    for (const r of rows) {
      if (r.timestamp) {
        if (!tmp.start || r.timestamp < tmp.start) tmp.start = r.timestamp;
        if (!tmp.end || r.timestamp > tmp.end) tmp.end = r.timestamp;
      }
      if (r.type !== 'assistant' || !r.message) continue;
      for (const b of r.message.content || []) if (b.type === 'tool_use') tmp.toolCalls++;
      const id = r.message.id || r.requestId || r.uuid;
      if (seen.has(id)) continue;
      seen.add(id);
      tmp.requests++;
      tmp.peak = Math.max(tmp.peak, usageTotal(r.message.usage));
      tmp.output += (r.message.usage && r.message.usage.output_tokens) || 0;
    }
    return {
      id: f.replace(/\.jsonl$/, ''),
      type: meta.agentType || 'subagent',
      description: meta.description || null,
      ...tmp,
    };
  });
}


export { parseSession, parseSubagents, est };
