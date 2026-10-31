// Live facts from free, public, official sources (no API key needed).
// Only things the dashboard actually uses:
//
// - Models overview (docs): current model IDs, context window, max output,
//   default effort, retirement. Used to size the context bar correctly and
//   for the "Current models" card. Refreshed daily.
// - npm registry: the latest Claude Code version. Used to flag sessions that
//   ran on an older version. Refreshed every 6 hours.
// - Status page (Statuspage API): is Claude up right now? Refreshed every
//   5 minutes. Hidden in the UI when it can't be reached.
//
// Everything degrades gracefully: on failure we keep the last good value, and
// fall back to public/data/live-snapshot.json. Turn off with NEWS=off.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ENABLED = (process.env.NEWS || 'on').toLowerCase() !== 'off';
const SNAPSHOT = path.join(__dirname, '..', 'public', 'data', 'live-snapshot.json');
const CACHE_FILE = path.join(os.tmpdir(), 'claude-context-dashboard-live.json');

const SOURCES = {
  models: { url: 'https://platform.claude.com/docs/en/about-claude/models/overview.md', page: 'https://platform.claude.com/docs/en/about-claude/models/overview', every: 24 * 3600e3 },
  version: { url: 'https://registry.npmjs.org/@anthropic-ai/claude-code/latest', page: 'https://code.claude.com/docs/en/changelog', every: 6 * 3600e3 },
  status: { urls: ['https://status.claude.com/api/v2/summary.json', 'https://status.anthropic.com/api/v2/summary.json'], page: 'https://status.claude.com', every: 5 * 60e3 },
};

function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }

let data = readJSON(CACHE_FILE) || readJSON(SNAPSHOT) || {};
const lastTry = {};

async function get(url, type = 'text') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'claude-context-dashboard' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return type === 'json' ? r.json() : r.text();
  } finally { clearTimeout(timer); }
}

const cellText = (c) => c.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').trim();
function tokens(s) {
  const m = String(s).match(/([\d.]+)\s*([KM])/i);
  return m ? Math.round(Number(m[1]) * (m[2].toUpperCase() === 'M' ? 1e6 : 1e3)) : null;
}

// The "Compare models" table: first column is the feature, one column per model.
function parseModels(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^\|\s*Feature\s*\|/.test(l));
  if (start < 0) throw new Error('models table not found (format changed?)');
  const rows = [];
  for (let i = start; i < lines.length && lines[i].startsWith('|'); i++) {
    if (/^\|\s*:?-{3,}/.test(lines[i])) continue;
    rows.push(lines[i].replace(/^\||\|\s*$/g, '').split('|'));
  }
  const header = rows[0].map(cellText);
  const row = (name) => rows.find((r) => cellText(r[0]).toLowerCase() === name.toLowerCase());
  const pageRow = row('Model page');
  const models = header.slice(1).map((name, i) => {
    const col = i + 1;
    const val = (n) => { const r = row(n); return r ? cellText(r[col] || '') : null; };
    const link = pageRow && (pageRow[col] || '').match(/\((https:[^)]+)\)/);
    return {
      name,
      id: val('Claude API ID'),
      contextWindow: tokens(val('Context window')),
      maxOutput: tokens(val('Max output')),
      defaultEffort: val('Default effort'),
      thinking: val('Thinking'),
      latency: val('Comparative latency'),
      retirement: val('Retirement'),
      page: link ? link[1] : null,
    };
  }).filter((m) => m.id);
  if (!models.length) throw new Error('no models parsed');
  return models;
}

async function refresh(key) {
  if (!ENABLED) return;
  lastTry[key] = Date.now();
  try {
    if (key === 'models') {
      data.models = { list: parseModels(await get(SOURCES.models.url)), updated: new Date().toISOString(), page: SOURCES.models.page };
    } else if (key === 'version') {
      const v = await get(SOURCES.version.url, 'json');
      data.version = { latest: v.version, updated: new Date().toISOString(), page: SOURCES.version.page };
    } else if (key === 'status') {
      let s = null;
      for (const u of SOURCES.status.urls) { try { s = await get(u, 'json'); break; } catch { /* try next */ } }
      if (!s) throw new Error('status page unreachable');
      data.status = {
        indicator: s.status && s.status.indicator, // none | minor | major | critical
        description: s.status && s.status.description,
        components: (s.components || []).filter((c) => !c.group && /claude|api|console/i.test(c.name)).slice(0, 6).map((c) => ({ name: c.name, status: c.status })),
        incidents: (s.incidents || []).slice(0, 3).map((x) => ({ name: x.name, status: x.status, url: x.shortlink })),
        updated: new Date().toISOString(),
        page: SOURCES.status.page,
      };
    }
    if (data[key]) delete data[key].error;
    try { fs.writeFileSync(CACHE_FILE, JSON.stringify(data)); } catch { /* fine */ }
  } catch (e) {
    data[key] = { ...(data[key] || {}), error: String(e.message || e) };
    if (key === 'status') data.status = { error: String(e.message || e) }; // never show a stale status
  }
}

function getLive() {
  if (ENABLED) {
    for (const key of Object.keys(SOURCES)) {
      const d = data[key];
      const age = d && d.updated ? Date.now() - new Date(d.updated).getTime() : Infinity;
      if (age > SOURCES[key].every && Date.now() - (lastTry[key] || 0) > 60e3) refresh(key);
    }
  }
  return { enabled: ENABLED, ...data };
}

function start() {
  if (!ENABLED) return;
  for (const key of Object.keys(SOURCES)) {
    refresh(key);
    setInterval(() => refresh(key), SOURCES[key].every).unref();
  }
}

module.exports = { getLive, start, refresh, parseModels };
