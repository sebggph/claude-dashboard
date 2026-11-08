// Token usage per agent: the main conversation, its subagents and workflow
// agents. Subagent transcripts live next to the session file:
//   <project>/<session-id>/subagents/agent-*.jsonl
//   <project>/<session-id>/subagents/workflows/<wf-id>/agent-*.jsonl
// Each agent's file has a .meta.json with its type and description.
//
// Per day we keep: all usage, cache writes that rebuilt the cache after a
// pause (the cache had expired), and requests with a very large context.

import fs from 'node:fs';
import path from 'node:path';
import { forEachLine, usageTotal } from './parser.js';

export const IDLE_GAP_MS = 5 * 60 * 1000; // subagent cache lifetime
export const BIG_CONTEXT = 400000; // tokens

const emptyBucket = (model, large) => ({ model, large, input: 0, cw5m: 0, cw1h: 0, read: 0, output: 0 });

function addTo(map, u, model, { cacheWriteOnly = false } = {}) {
  const cw = u.cache_creation_input_tokens || 0;
  const cw1h = Math.min(cw, (u.cache_creation && u.cache_creation.ephemeral_1h_input_tokens) || 0);
  const large = usageTotal(u) > 100000;
  const key = `${model || 'unknown'}|${large ? 'large' : 'std'}`;
  const b = map[key] || (map[key] = emptyBucket(model || 'unknown', large));
  b.cw5m += cw - cw1h;
  b.cw1h += cw1h;
  if (cacheWriteOnly) return;
  b.input += u.input_tokens || 0;
  b.read += u.cache_read_input_tokens || 0;
  b.output += u.output_tokens || 0;
}

/** Usage of one transcript file (main session or one agent), per day. */
export function scanFile(file, { sidechain = false } = {}) {
  const reqs = new Map(); // message id -> { time, model, usage }; later lines carry the final usage
  forEachLine(file, (line) => {
    if (!line.includes('"usage"')) return;
    let d;
    try { d = JSON.parse(line); } catch { return; }
    if (d.type !== 'assistant' || !d.message || !d.message.usage || d.message.model === '<synthetic>') return;
    if (!sidechain && d.isSidechain) return;
    const id = d.message.id || d.requestId || d.uuid;
    const prev = reqs.get(id);
    reqs.set(id, { time: (prev && prev.time) || d.timestamp, model: d.message.model, usage: d.message.usage });
  });
  const list = [...reqs.values()].filter((r) => r.time).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const out = { requests: list.length, peak: 0, model: null, start: list[0]?.time || null, end: list.at(-1)?.time || null, days: {} };
  let prevTime = null;
  for (const r of list) {
    const u = r.usage;
    const ctx = usageTotal(u);
    const cw = u.cache_creation_input_tokens || 0;
    const t = Date.parse(r.time);
    out.peak = Math.max(out.peak, ctx);
    if (r.model) out.model = r.model;
    const day = String(r.time).slice(0, 10);
    const d = out.days[day] || (out.days[day] = { requests: 0, all: {}, idle: {}, big: {}, idleCount: 0, bigCount: 0 });
    d.requests++;
    addTo(d.all, u, r.model);
    // A pause, then most of the context written to the cache again: it had expired.
    if (prevTime != null && t - prevTime > IDLE_GAP_MS && ctx > 20000 && cw >= ctx * 0.5) {
      d.idleCount++;
      addTo(d.idle, u, r.model, { cacheWriteOnly: true });
    }
    if (ctx > BIG_CONTEXT) {
      d.bigCount++;
      addTo(d.big, u, r.model);
    }
    prevTime = t;
  }
  return out;
}

const cache = new Map();
function cachedScan(file, opts) {
  let st;
  try { st = fs.statSync(file); } catch { return null; }
  const hit = cache.get(file);
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit.value;
  let value = null;
  try { value = scanFile(file, opts); } catch { value = null; }
  cache.set(file, { mtime: st.mtimeMs, size: st.size, value });
  return value;
}

function readMeta(file) {
  try { return JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, '.meta.json'), 'utf8')); } catch { return {}; }
}

function agentFiles(dir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...agentFiles(p));
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

/** The main conversation plus every subagent and workflow agent of a session. */
export function agentsOf(sessionFile) {
  const agents = [];
  const main = cachedScan(sessionFile);
  if (main && main.requests) agents.push({ id: 'main', kind: 'main', type: null, description: null, workflow: null, ...main });
  const subDir = path.join(path.dirname(sessionFile), path.basename(sessionFile, '.jsonl'), 'subagents');
  for (const f of agentFiles(subDir)) {
    const v = cachedScan(f, { sidechain: true });
    if (!v || !v.requests) continue;
    const rel = path.relative(subDir, f).split(path.sep);
    const workflow = rel[0] === 'workflows' && rel.length > 2 ? rel[1] : null;
    const meta = readMeta(f);
    agents.push({
      id: path.basename(f, '.jsonl'),
      kind: workflow ? 'workflow' : 'subagent',
      type: meta.agentType || null,
      description: meta.description || null,
      workflow,
      ...v,
    });
  }
  return agents;
}

/** Subagent + workflow usage of a session, per day, in the same shape as the parser's byDay. */
export function agentDays(agents) {
  const out = {};
  let count = 0;
  for (const a of agents) {
    if (a.kind === 'main') continue;
    count++;
    for (const [day, v] of Object.entries(a.days)) {
      const d = out[day] || (out[day] = { requests: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, byModel: {} });
      d.requests += v.requests;
      for (const [k, b] of Object.entries(v.all)) {
        d.input += b.input; d.cacheWrite += b.cw5m + b.cw1h; d.cacheRead += b.read; d.output += b.output;
        const m = d.byModel[k] || (d.byModel[k] = emptyBucket(b.model, b.large));
        for (const f of ['input', 'cw5m', 'cw1h', 'read', 'output']) m[f] += b[f];
      }
    }
  }
  return { count, byDay: out };
}
