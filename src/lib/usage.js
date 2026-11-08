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
 * Totals for the given days (or hours).
 * @param usage   answer of /api/usage
 * @param select  list of 'YYYY-MM-DD', or a function (hour 'YYYY-MM-DDTHH') => boolean
 * @param pricing price list (null → costs are 0, tokens still work)
 * @param opts    { project: only this project, skip: leave out this session id }
 */
export function summarize(usage, select, pricing, { project = null, skip = null } = {}) {
  const days = Array.isArray(select) ? select : null;
  const set = new Set(days || []);
  const want = days ? (h) => set.has(h.slice(0, 10)) : select;
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
    if ((project && s.project !== project) || s.id === skip) continue;
    const row = { id: s.id, title: s.title, project: s.project, usd: 0, tokens: 0, agentUsd: 0, agents: 0, requests: 0 };
    for (const a of s.agents || []) {
      const ds = Object.entries(a.hours || {}).filter(([h]) => want(h)).map(([, v]) => v);
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

      // Waiting agents only: a main conversation also rewrites its cache after
      // /compact or a model switch, which isn't what this finding is about.
      if (a.kind !== 'main') {
        const idleUsd = price(sumBuckets(ds.map((d) => d.idle)));
        idle.usd += idleUsd; idle.count += ds.reduce((x, d) => x + (d.idleCount || 0), 0);
        addTo(idle.byProject, s.project, idleUsd);
      }
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
 * What each finding measures, as a share of usage, and the share from which
 * it shows up (`limit`) or counts as serious. Used to find issues and to
 * check a fix afterwards with the same yardstick.
 */
export const METRICS = {
  memory_loads: { value: (s) => (s.usd ? s.loads.usd / s.usd : 0), limit: 0.1, serious: 0.2, agents: true },
  idle_rebuilds: { value: (s) => (s.usd ? s.idle.usd / s.usd : 0), limit: 0.08, serious: 0.15, agents: true },
  agents_share: { value: (s) => s.agentShare, limit: 0.4, serious: 0.6, agents: true },
  big_context: { value: (s) => (s.usd ? s.big.usd / s.usd : 0), limit: 0.15, serious: 0.3, agents: false },
  one_model: { value: (s) => (s.usd && s.models[0] && isTopModel(s.models[0].model) ? s.models[0].usd / s.usd : 0), limit: 0.9, serious: 2, agents: true },
  workflows: { value: (s) => (s.usd ? s.kinds.workflow.usd / s.usd : 0), limit: 0.1, serious: 2, agents: true },
};
const levelOf = (id, v) => (v >= METRICS[id].serious ? 'serious' : id === 'workflows' ? 'info' : 'warning');

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

  const hit = (id) => METRICS[id].value(cur) >= METRICS[id].limit;
  if (hit('memory_loads')) {
    add('memory_loads', levelOf('memory_loads', METRICS.memory_loads.value(cur)),
      { share: share(cur.loads.usd), usd: cur.loads.usd, n: cur.loads.count }, cur.loads.project,
      fams((f) => f.loads));
  }
  if (hit('idle_rebuilds')) {
    add('idle_rebuilds', levelOf('idle_rebuilds', METRICS.idle_rebuilds.value(cur)),
      { share: share(cur.idle.usd), usd: cur.idle.usd, n: cur.idle.count }, cur.idle.project, fams());
  }
  if (hit('agents_share')) {
    add('agents_share', levelOf('agents_share', cur.agentShare),
      { share: cur.agentShare, usd: cur.kinds.subagent.usd + cur.kinds.workflow.usd, n: cur.agents }, cur.families[0]?.project || cur.projects[0]?.project, fams(() => true, 5));
  }
  const topModel = cur.models[0];
  if (hit('one_model') && cur.agentShare >= 0.3) {
    add('one_model', 'warning', { share: topModel.usd / cur.usd, usd: topModel.usd, model: topModel.model, n: cur.agents },
      cur.families[0]?.project || cur.projects[0]?.project, fams((f) => /map|find|verify|search|research|check|explore|scan|read/i.test(f.name), 4));
  }
  if (hit('workflows')) {
    add('workflows', 'info', { share: share(cur.kinds.workflow.usd), usd: cur.kinds.workflow.usd, n: cur.workflows },
      cur.families.find((f) => f.kind === 'workflow')?.project || cur.projects[0]?.project, fams((f) => f.kind === 'workflow'));
  }
  if (hit('big_context')) {
    add('big_context', levelOf('big_context', METRICS.big_context.value(cur)),
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

// Claude Code's deep link opens a terminal with Claude Code in a folder and the
// prompt typed in (not sent). The prompt may be up to 5,000 characters.
// https://code.claude.com/docs/en/deep-links
export const DEEP_LINK_MAX = 5000;

/** claude-cli://open link for the project and prompt, or null when it can't be used. */
export function deepLink(project, prompt) {
  const absolute = String(project || '').startsWith('/') || /^[A-Za-z]:\\/.test(project || '');
  if (!absolute) return null;
  if (!prompt || prompt.length > DEEP_LINK_MAX) return null;
  return `claude-cli://open?cwd=${encodeURIComponent(project)}&q=${encodeURIComponent(prompt)}`;
}

// ---------- fixes: tag, find, check ----------

// Every fix prompt starts with this tag, so the dashboard can find the session
// that ran it in the transcripts (and not offer the same fix twice).
export const fixTagFor = (id) => `[Dashboard fix: ${id}]`;
export function fixTag(firstPrompt) {
  const m = /^\s*\[Dashboard fix: ([a-z_]+)\]/.exec(String(firstPrompt || ''));
  return m && METRICS[m[1]] ? m[1] : null;
}

/** Sessions that ran a fix: [{ id, project, session, title, start }], newest first. */
export function fixesIn(usage) {
  return (usage?.sessions || []).filter((s) => s.fix)
    .map((s) => ({ id: s.fix, project: s.project, session: s.id, title: String(s.title || '').replace(/^\s*\[Dashboard fix: [a-z_]+\]\s*/, '') || null, start: s.start }))
    .sort((a, b) => String(b.start).localeCompare(String(a.start)));
}

/**
 * Fixes made another way, marked by hand ({ 'id|project': iso time }), in the
 * same shape as fix sessions. Checked from that moment on.
 */
export const markedFixes = (marks) => Object.entries(marks || {}).map(([k, start]) => {
  const i = k.indexOf('|');
  return { id: k.slice(0, i), project: k.slice(i + 1), session: null, title: null, start, manual: true };
}).filter((f) => METRICS[f.id] && f.start);

/** The latest fix session for a finding in a project, or null. */
export const latestFix = (fixes, id, project) => fixes.filter((f) => f.id === id && f.project === project).sort((a, b) => String(b.start).localeCompare(String(a.start)))[0] || null;

const hourOf = (t) => new Date(t).toISOString().slice(0, 13);
export const MIN_REQUESTS = 50, MIN_AGENTS = 3, MAX_WAIT_HOURS = 72;

/**
 * Did the fix work? Compares the finding's share of usage in that project in
 * the 7 days before the fix session with the time after it started (the fix
 * session itself left out). Only reads measured usage; nothing is run.
 * → { status: 'waiting' | 'fixed' | 'still', before, after, limit, requests, agents }
 */
export function checkFix(usage, fix, pricing, now = new Date()) {
  const m = METRICS[fix.id];
  const startHour = hourOf(fix.start);
  const weekBefore = hourOf(new Date(fix.start).getTime() - 7 * DAY);
  const opts = { project: fix.project, skip: fix.session };
  const before = summarize(usage, (h) => h >= weekBefore && h < startHour, pricing, opts);
  const after = summarize(usage, (h) => h > startHour, pricing, opts);
  const hours = (now - new Date(fix.start)) / 3600000;
  const enough = after.requests >= MIN_REQUESTS && (!m.agents || after.agents >= MIN_AGENTS || hours >= MAX_WAIT_HOURS);
  const value = m.value(after);
  return {
    // Without prices every share is 0, so don't judge.
    status: !enough || !pricing ? 'waiting' : value < m.limit ? 'fixed' : 'still',
    before: m.value(before), after: value, limit: m.limit,
    requests: after.requests, agents: after.agents, needAgents: m.agents,
  };
}

// ---------- live monitor ----------

export const CACHE_TTL_MS = 5 * 60 * 1000; // subagents
export const MONITOR_DEFAULTS = { restartAt: 200000, workflowUsd: 25, notify: false };

/**
 * Status of one agent right now:
 * finished · working (a request in the last minute) · idle (cache still warm,
 * `expiresIn` ms left) · expired (the next message writes the whole context again).
 */
export function agentStatus(a, now = Date.now()) {
  if (a.finished) return { state: 'finished' };
  const since = now - new Date(a.last?.time || a.end).getTime();
  if (a.kind === 'main') return { state: since < 60000 ? 'working' : 'waiting', since };
  if (since < 60000) return { state: 'working', since };
  if (since < CACHE_TTL_MS) return { state: 'idle', since, expiresIn: CACHE_TTL_MS - since };
  return { state: 'expired', since };
}

/**
 * Rows for the monitor: one per agent with its cost and flags, grouped per
 * session, plus workflow runs and totals.
 */
export function monitorView(live, pricing, now = Date.now(), opts = MONITOR_DEFAULTS) {
  const price = (total) => (pricing ? costOf(Object.values(total || {}), pricing).usd : 0);
  const sessions = [], workflows = new Map();
  const totals = { running: 0, idle: 0, expired: 0, context: 0, usd: 0, restart: 0 };
  for (const s of live?.sessions || []) {
    const rows = (s.agents || []).map((a) => {
      const st = agentStatus(a, now);
      const ctx = a.last?.ctx || 0;
      const usd = price(a.total);
      const restart = a.kind !== 'main' && !a.finished && ctx >= opts.restartAt;
      // What the next message costs to rebuild the cache once it expired.
      const rewriteUsd = pricing && st.state !== 'finished' ? price({ k: { model: a.model, large: ctx > 100000, input: 0, cw5m: ctx, cw1h: 0, read: 0, output: 0 } }) : 0;
      if (st.state !== 'finished' && a.kind !== 'main') {
        totals.running++; totals.context += ctx;
        if (st.state === 'idle') totals.idle++;
        if (st.state === 'expired') totals.expired++;
        if (restart) totals.restart++;
      }
      totals.usd += usd;
      if (a.workflow) {
        const w = workflows.get(s.id + a.workflow) || { id: a.workflow, session: s.id, title: s.title, project: s.project, agents: 0, active: 0, usd: 0, start: a.start };
        w.agents++; w.usd += usd;
        if (st.state === 'working' || st.state === 'idle') w.active++;
        if (String(a.start) < String(w.start)) w.start = a.start;
        workflows.set(s.id + a.workflow, w);
      }
      return { ...a, status: st, ctx, usd, restart, rewriteUsd, family: familyOf(a) };
    });
    const order = { working: 0, idle: 1, waiting: 2, expired: 3, finished: 4 };
    rows.sort((x, y) => (x.kind === 'main' ? -1 : y.kind === 'main' ? 1 : order[x.status.state] - order[y.status.state] || y.ctx - x.ctx));
    sessions.push({ ...s, rows, active: rows.some((r) => r.status.state === 'working' || r.status.state === 'idle') });
  }
  sessions.sort((a, b) => Number(b.active) - Number(a.active) || String(b.rows[0]?.last?.time).localeCompare(String(a.rows[0]?.last?.time)));
  const wf = [...workflows.values()].map((w) => ({ ...w, over: w.usd >= opts.workflowUsd })).sort((a, b) => b.usd - a.usd);
  return { sessions, workflows: wf, totals };
}

/**
 * Notifications to send for the current view (each once): agents that passed
 * the restart size, workflow runs that passed the cost limit.
 */
export function monitorAlerts(view) {
  const out = [];
  for (const s of view.sessions) for (const r of s.rows) if (r.restart) out.push({ key: `restart.${r.id}`, kind: 'restart', name: r.description || r.type || r.id, ctx: r.ctx });
  for (const w of view.workflows) if (w.over) out.push({ key: `wf.${w.session}.${w.id}`, kind: 'workflow', name: w.title || w.id, usd: w.usd });
  return out;
}

// ---------- weekly plan forecast ----------

const hourKey = (ms) => new Date(ms).toISOString().slice(0, 13);
const usdBetween = (usage, from, to, pricing) => summarize(usage, (h) => h >= hourKey(from) && h < hourKey(to), pricing).usd;

/**
 * The latest weekly reading: from the status line log when recent (≤ 6 h),
 * else the one typed in by hand. → { pct, at (ms), resetsAt (ms), source } or null
 */
export function planReading(points, manual, now = Date.now()) {
  const p = [...(points || [])].reverse().find((x) => x.week && x.week.resets);
  if (p && now - Date.parse(p.t) <= 6 * 3600000 && p.week.resets * 1000 > now) {
    return { pct: p.week.pct, at: Date.parse(p.t), resetsAt: p.week.resets * 1000, source: 'statusline' };
  }
  if (manual && manual.pct != null && manual.at && manual.resetsAt) {
    let resetsAt = Date.parse(manual.resetsAt);
    // The week starts again every 7 days after the reset you typed in.
    while (resetsAt <= now) resetsAt += 7 * DAY;
    const at = Date.parse(manual.at);
    if (at > resetsAt - 7 * DAY) return { pct: Number(manual.pct), at, resetsAt, source: 'manual' };
    return { pct: 0, at: resetsAt - 7 * DAY, resetsAt, source: 'manual', reset: true, ratioFrom: { pct: Number(manual.pct), at, resetsAt: resetsAt - 7 * DAY } };
  }
  return p && p.week.resets * 1000 > now ? { pct: p.week.pct, at: Date.parse(p.t), resetsAt: p.week.resets * 1000, source: 'statusline', stale: true } : null;
}

/**
 * Estimated weekly % now and when you'd reach 100% at the pace of the last
 * 24 hours. Uses the reading to learn how much usage (at API prices) is 1% of
 * your week, then adds what happened since the reading.
 */
export function planForecast(usage, reading, pricing, now = Date.now()) {
  if (!reading || !pricing) return null;
  const ref = reading.ratioFrom || reading;
  const windowStart = ref.resetsAt - 7 * DAY;
  const usedAtRef = usdBetween(usage, windowStart, ref.at, pricing);
  const perPct = ref.pct >= 1 && usedAtRef > 0 ? usedAtRef / ref.pct : null; // $ per 1% of the week
  if (!perPct) return { reading, perPct: null, pct: reading.pct, resetsAt: reading.resetsAt };
  const pct = Math.min(100, reading.pct + usdBetween(usage, reading.at, now, pricing) / perPct);
  const perHour = usdBetween(usage, now - DAY, now, pricing) / 24 / perPct; // % per hour, last 24 h
  const hoursLeft = (reading.resetsAt - now) / 3600000;
  const atReset = Math.min(100, pct + perHour * hoursLeft);
  const hitAt = perHour > 0 && pct < 100 ? now + ((100 - pct) / perHour) * 3600000 : null;
  return { reading, perPct, pct, perHour, resetsAt: reading.resetsAt, atReset, hitAt: hitAt && hitAt < reading.resetsAt ? hitAt : null };
}

/** Cost per workflow run in the given days: [{ id, session, title, project, agents, usd, start }]. */
export function workflowRuns(usage, days, pricing) {
  const set = new Set(days);
  const runs = new Map();
  for (const s of usage?.sessions || []) for (const a of s.agents || []) {
    if (!a.workflow) continue;
    const bs = sumBuckets(Object.entries(a.hours || {}).filter(([h]) => set.has(h.slice(0, 10))).map(([, v]) => v.all));
    if (!bs.length) continue;
    const k = s.id + a.workflow;
    const w = runs.get(k) || { id: a.workflow, session: s.id, title: s.title, project: s.project, agents: 0, usd: 0, tokens: 0, start: a.start, families: new Map() };
    w.agents++; w.usd += pricing ? costOf(bs, pricing).usd : 0; w.tokens += tokensOf(bs);
    if (String(a.start) < String(w.start)) w.start = a.start;
    const f = familyOf(a); w.families.set(f, (w.families.get(f) || 0) + 1);
    runs.set(k, w);
  }
  return [...runs.values()].map(({ families, ...w }) => ({ ...w, top: [...families.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} ×${c}`) }))
    .sort((a, b) => b.usd - a.usd || b.tokens - a.tokens);
}
