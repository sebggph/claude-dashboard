// What uses the most tokens: main conversations, subagents and workflow
// agents, grouped per week, with findings and ready-to-paste fix prompts.
// Pure functions (no app state), so they can be tested with node --test.

import { costOf } from './cost.js';

const DAY = 86400000;
const KINDS = ['main', 'subagent', 'workflow'];
const sumBuckets = (maps) => maps.flatMap((m) => Object.values(m || {}));
const tokensOf = (bs) => bs.reduce((a, b) => a + b.input + b.cw5m + b.cw1h + b.read + b.output, 0);
const cacheWriteOnly = (bs) => bs.map((b) => ({ ...b, input: 0, read: 0, output: 0 }));

/** Last 7 UTC days ending `today`, and the same for `back` weeks earlier. */
export function weekDays(today = new Date(), back = 0) {
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - back * 7 * DAY;
  return Array.from({ length: 7 }, (_, i) => new Date(end - (6 - i) * DAY).toISOString().slice(0, 10));
}

/**
 * A short name that groups agents started the same way,
 * e.g. "Tech review 98 (Domains)" and "Tech review 99" → "Tech review #".
 */
export function familyOf(a) {
  if (a.kind === 'main') return null;
  const d = String(a.description || '').trim();
  if (!d) return a.type || a.kind;
  return d.replace(/\(.*?\)/g, '').split(/[:,–—]| - /)[0].replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 48) || a.type || a.kind;
}

// Agents whose job is to (re)load a big memory before they can work.
const LOAD_RE = /\b(re-?start|start|load|reload|memory|warm[- ]?up|onboard)/i;

/**
 * Totals for the given days.
 * @param usage answer of /api/usage
 * @param days  list of 'YYYY-MM-DD'
 * @param pricing price list (null → costs are null, tokens still work)
 */
export function summarize(usage, days, pricing) {
  const set = new Set(days);
  const price = (bs) => (pricing ? costOf(bs, pricing).usd : 0);
  const kinds = Object.fromEntries(KINDS.map((k) => [k, { usd: 0, tokens: 0, requests: 0, agents: 0 }]));
  const models = new Map(), projects = new Map(), families = new Map();
  const sessions = [];
  const workflows = new Set();
  const idle = { usd: 0, count: 0, byProject: new Map() };
  const big = { usd: 0, count: 0, byProject: new Map() };
  const loads = { usd: 0, count: 0, byProject: new Map() };
  let usd = 0, tokens = 0, requests = 0, cacheWriteUsd = 0;
  const addTo = (map, key, v) => map.set(key, (map.get(key) || 0) + v);

  for (const s of usage?.sessions || []) {
    const row = { id: s.id, title: s.title, project: s.project, usd: 0, tokens: 0, agentUsd: 0, agents: 0, requests: 0 };
    for (const a of s.agents || []) {
      const ds = Object.entries(a.days || {}).filter(([d]) => set.has(d)).map(([, v]) => v);
      if (!ds.length) continue;
      const bs = sumBuckets(ds.map((d) => d.all));
      const req = ds.reduce((x, d) => x + d.requests, 0);
      const cost = price(bs), tok = tokensOf(bs);
      const k = kinds[a.kind] || kinds.subagent;
      k.usd += cost; k.tokens += tok; k.requests += req; k.agents++;
      usd += cost; tokens += tok; requests += req;
      cacheWriteUsd += price(cacheWriteOnly(bs));
      row.usd += cost; row.tokens += tok; row.requests += req;
      if (a.kind !== 'main') { row.agentUsd += cost; row.agents++; }
      if (a.workflow) workflows.add(s.id + a.workflow);
      for (const b of bs) {
        const m = models.get(b.model) || { model: b.model, usd: 0, tokens: 0 };
        m.usd += price([b]); m.tokens += tokensOf([b]);
        models.set(b.model, m);
      }

      const idleBs = sumBuckets(ds.map((d) => d.idle));
      const idleUsd = price(idleBs);
      idle.usd += idleUsd; idle.count += ds.reduce((x, d) => x + (d.idleCount || 0), 0);
      addTo(idle.byProject, s.project, idleUsd);
      if (a.kind === 'main') {
        const bigUsd = price(sumBuckets(ds.map((d) => d.big)));
        big.usd += bigUsd; big.count += ds.reduce((x, d) => x + (d.bigCount || 0), 0);
        addTo(big.byProject, s.project, bigUsd);
      } else {
        const fam = familyOf(a);
        const f = families.get(fam) || { name: fam, kind: a.kind, count: 0, usd: 0, requests: 0, peak: 0, loads: false, projects: new Map() };
        f.count++; f.usd += cost; f.requests += req; f.peak = Math.max(f.peak, a.peak || 0);
        addTo(f.projects, s.project, cost);
        families.set(fam, f);
        if (LOAD_RE.test(a.description || '')) { f.loads = true; loads.usd += cost; loads.count++; addTo(loads.byProject, s.project, cost); }
      }
    }
    if (row.requests) {
      sessions.push(row);
      const p = projects.get(s.project) || { project: s.project, usd: 0, tokens: 0, agentUsd: 0, sessions: 0 };
      p.usd += row.usd; p.tokens += row.tokens; p.agentUsd += row.agentUsd; p.sessions++;
      projects.set(s.project, p);
    }
  }

  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const byUsd = (a, b) => b.usd - a.usd || b.tokens - a.tokens;
  return {
    days, usd, tokens, requests, cacheWriteUsd,
    kinds,
    agentShare: usd ? (kinds.subagent.usd + kinds.workflow.usd) / usd : 0,
    agents: kinds.subagent.agents + kinds.workflow.agents,
    workflows: workflows.size,
    models: [...models.values()].sort(byUsd),
    projects: [...projects.values()].sort(byUsd),
    sessions: sessions.sort(byUsd),
    families: [...families.values()].map((f) => ({ ...f, project: top(f.projects), projects: undefined })).sort((a, b) => b.usd - a.usd),
    idle: { usd: idle.usd, count: idle.count, project: top(idle.byProject) },
    big: { usd: big.usd, count: big.count, project: top(big.byProject) },
    loads: { usd: loads.usd, count: loads.count, project: top(loads.byProject) },
  };
}

/** Change from `before` to `now` (null when there was nothing before). */
export const growth = (now, before) => (before > 0 ? now / before : null);

const isTopModel = (m) => /opus|fable|mythos/i.test(m || '');

/**
 * What to improve, most important first. Each finding has an id (for texts),
 * a level, the numbers behind it, the project to fix it in, and evidence
 * lines for the fix prompt.
 */
export function findingsFor(cur, prev) {
  const out = [];
  if (!cur || !cur.usd) return out;
  const share = (x) => x / cur.usd;
  const fams = (filter = () => true, n = 3) => cur.families.filter(filter).slice(0, n);
  // Order: most serious first, then what you can change most directly.
  const ORDER = ['memory_loads', 'idle_rebuilds', 'agents_share', 'big_context', 'one_model', 'workflows'];
  const RANK = { serious: 0, warning: 1, info: 2 };
  const add = (id, level, vars, project, evidence) => out.push({ id, level, vars, project, evidence, score: RANK[level] * 10 + ORDER.indexOf(id) });

  if (share(cur.loads.usd) >= 0.1) {
    add('memory_loads', share(cur.loads.usd) >= 0.2 ? 'serious' : 'warning',
      { share: share(cur.loads.usd), usd: cur.loads.usd, n: cur.loads.count }, cur.loads.project,
      fams((f) => f.loads));
  }
  if (share(cur.idle.usd) >= 0.08) {
    add('idle_rebuilds', share(cur.idle.usd) >= 0.15 ? 'serious' : 'warning',
      { share: share(cur.idle.usd), usd: cur.idle.usd, n: cur.idle.count }, cur.idle.project, fams());
  }
  if (cur.agentShare >= 0.4) {
    add('agents_share', cur.agentShare >= 0.6 ? 'serious' : 'warning',
      { share: cur.agentShare, usd: cur.kinds.subagent.usd + cur.kinds.workflow.usd, n: cur.agents }, cur.families[0]?.project || cur.projects[0]?.project, fams(() => true, 5));
  }
  const topModel = cur.models[0];
  if (topModel && isTopModel(topModel.model) && topModel.usd / cur.usd >= 0.9 && cur.agentShare >= 0.3) {
    add('one_model', 'warning', { share: topModel.usd / cur.usd, usd: topModel.usd, model: topModel.model, n: cur.agents },
      cur.families[0]?.project || cur.projects[0]?.project, fams((f) => /map|find|verify|search|research|check|explore|scan|read/i.test(f.name), 4));
  }
  if (share(cur.kinds.workflow.usd) >= 0.1) {
    add('workflows', 'info', { share: share(cur.kinds.workflow.usd), usd: cur.kinds.workflow.usd, n: cur.workflows },
      cur.families.find((f) => f.kind === 'workflow')?.project || cur.projects[0]?.project, fams((f) => f.kind === 'workflow'));
  }
  if (share(cur.big.usd) >= 0.15) {
    add('big_context', share(cur.big.usd) >= 0.3 ? 'serious' : 'warning',
      { share: share(cur.big.usd), usd: cur.big.usd, n: cur.big.count }, cur.big.project, []);
  }
  out.sort((a, b) => a.score - b.score);
  const g = prev ? growth(cur.usd, prev.usd) : null;
  if (g != null && g >= 2) {
    // What grew the most, in dollars.
    const diff = KINDS.map((k) => ({ k, d: cur.kinds[k].usd - prev.kinds[k].usd })).sort((a, b) => b.d - a.d)[0];
    out.unshift({ id: 'growth', level: g >= 4 ? 'serious' : 'warning', vars: { x: g, kind: diff.k, before: prev.usd, usd: cur.usd }, project: null, evidence: [], score: -1 });
  }
  return out;
}

/** A shell-safe single-quoted string. */
export const shellQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** Command that opens Claude Code in the project with the prompt already typed in. */
export function fixCommand(project, prompt) {
  const run = `claude ${shellQuote(prompt)}`;
  return project ? `cd ${shellQuote(project)} && ${run}` : run;
}
