// News: fetches official Claude release notes, parses them into a simple
// structure and tags what matters for context. Refreshes in the background.
//
// Sources (official, public, no API key):
// - Claude Code changelog (versions, dates, grouped changes)
// - Claude Platform release notes (API, SDKs, Console)
//
// Turn off with NEWS=off. Without network it falls back to the bundled
// snapshot in public/data/news-snapshot.json.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SOURCES = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    url: 'https://code.claude.com/docs/en/changelog.md',
    page: 'https://code.claude.com/docs/en/changelog',
    parse: parseClaudeCode,
  },
  {
    id: 'platform',
    name: 'Claude Platform',
    url: 'https://platform.claude.com/docs/en/release-notes/overview.md',
    page: 'https://platform.claude.com/docs/en/release-notes/overview',
    parse: parsePlatform,
  },
];

const MAX_RELEASES = 20; // per source
const ENABLED = (process.env.NEWS || 'on').toLowerCase() !== 'off';
const REFRESH_MS = Math.max(1, Number(process.env.NEWS_REFRESH_HOURS || 6)) * 3600 * 1000;
const CACHE_FILE = process.env.NEWS_CACHE || path.join(os.tmpdir(), 'claude-context-dashboard-news.json');
const SNAPSHOT = path.join(__dirname, '..', 'public', 'data', 'news-snapshot.json');

// Keyword tags. "context" is the one the dashboard highlights.
const TAGS = [
  ['context', /\b(context window|context usage|\/context|compact(ion|ing|ed|s)?|autocompact|prompt cach\w*|cache (hit|read|write|miss)\w*|CLAUDE\.md|MEMORY\.md|auto memory|token usage|input tokens|1M)\b|\/compact|\/clear/i],
  ['models', /\b(Opus|Sonnet|Haiku|Fable|model|effort|thinking|fast mode)\b/i],
  ['mcp', /\bMCP\b/],
  ['skills', /\b(skill|skills|plugin|plugins|subagent|sub-agent|agents?)\b/i],
  ['commands', /(^|[\s`])\/[a-z][a-z-]+/],
  ['deprecation', /\b(deprecat\w*|removed|removal|legacy|retire\w*)\b/i],
];

function tagsFor(text) {
  return TAGS.filter(([, re]) => re.test(text)).map(([t]) => t);
}

function cleanItem(s) {
  return s.replace(/^\s*[*-]\s+/, '').replace(/\\([[\]_*])/g, '$1').trim();
}

// "**2.1.316**" / "October 31, 2026" / "**Added**" / "* item"
function parseClaudeCode(md) {
  const lines = md.split('\n');
  const releases = [];
  let rel = null;
  let group = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const v = line.match(/^\*\*(\d+\.\d+\.\d+)\*\*$/);
    if (v) {
      if (releases.length >= MAX_RELEASES) break;
      rel = { source: 'claude-code', version: v[1], date: null, groups: [] };
      releases.push(rel);
      group = null;
      continue;
    }
    if (!rel) continue;
    if (!rel.date && /^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(line)) { rel.date = new Date(line + ' UTC').toISOString().slice(0, 10); continue; }
    const g = line.match(/^\*\*(.+)\*\*$/);
    if (g) {
      const label = g[1];
      const type = /bug fix/i.test(label) ? 'fixed' : /improvement/i.test(label) ? 'improved' : label.toLowerCase();
      group = { type, label, items: [] };
      rel.groups.push(group);
      continue;
    }
    if (/^[*-]\s+/.test(line)) {
      if (!group) { group = { type: 'changes', label: 'Changes', items: [] }; rel.groups.push(group); }
      const text = cleanItem(line);
      group.items.push({ text, tags: tagsFor(text) });
    }
  }
  return releases;
}

// "### October 30, 2026" then "* item" lines. Skips MDX blocks like <Tip>.
function parsePlatform(md) {
  const releases = [];
  let rel = null;
  let inTag = 0;
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (/^<[A-Z]\w*/.test(line)) inTag++;
    if (/^<\/[A-Z]\w*>/.test(line)) { inTag = Math.max(0, inTag - 1); continue; }
    if (inTag) continue;
    const d = line.match(/^###\s+([A-Z][a-z]+ \d{1,2}, \d{4})$/);
    if (d) {
      if (releases.length >= MAX_RELEASES) break;
      rel = { source: 'platform', version: null, date: new Date(d[1] + ' UTC').toISOString().slice(0, 10), groups: [{ type: 'changes', label: 'Changes', items: [] }] };
      releases.push(rel);
      continue;
    }
    if (rel && /^[*-]\s+/.test(line)) {
      const text = cleanItem(line).replace(/^We[’']ve /, '');
      rel.groups[0].items.push({ text: text.charAt(0).toUpperCase() + text.slice(1), tags: tagsFor(text) });
    }
  }
  return releases.filter((r) => r.groups[0].items.length);
}

// ---------- fetching & caching ----------

let state = null; // { updated, sources:[{id,name,page,ok,error}], releases:[] }
let inflight = null;

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'claude-context-dashboard' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

async function refresh() {
  if (inflight) return inflight;
  inflight = (async () => {
    const prev = state || readJSON(CACHE_FILE) || readJSON(SNAPSHOT) || { releases: [] };
    const sources = [];
    let releases = [];
    for (const src of SOURCES) {
      try {
        const parsed = src.parse(await fetchText(src.url));
        if (!parsed.length) throw new Error('nothing parsed (format changed?)');
        releases = releases.concat(parsed);
        sources.push({ id: src.id, name: src.name, page: src.page, ok: true });
      } catch (e) {
        // Keep the last good copy of this source.
        releases = releases.concat((prev.releases || []).filter((r) => r.source === src.id));
        sources.push({ id: src.id, name: src.name, page: src.page, ok: false, error: String(e.message || e) });
      }
    }
    releases.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.version).localeCompare(String(a.version), undefined, { numeric: true }));
    const anyOk = sources.some((s) => s.ok);
    state = { updated: anyOk ? new Date().toISOString() : prev.updated || null, offline: !anyOk, sources, releases };
    if (anyOk) {
      try { fs.writeFileSync(CACHE_FILE, JSON.stringify(state)); } catch { /* read-only fs is fine */ }
    }
    return state;
  })().finally(() => { inflight = null; });
  return inflight;
}

function current() {
  if (state) return state;
  const cached = readJSON(CACHE_FILE) || readJSON(SNAPSHOT);
  return cached ? { ...cached, offline: true } : { updated: null, offline: true, sources: [], releases: [] };
}

let lastManual = 0;
async function getNews({ force = false } = {}) {
  if (!ENABLED) return { ...current(), disabled: true };
  const s = current();
  const stale = !s.updated || Date.now() - new Date(s.updated).getTime() > REFRESH_MS;
  // Manual refresh at most once a minute, to be polite to the docs site.
  if (force && Date.now() - lastManual > 60000) { lastManual = Date.now(); return refresh(); }
  if (stale && !inflight) refresh().catch(() => {});
  return s;
}

function start() {
  if (!ENABLED) return;
  refresh().catch(() => {});
  setInterval(() => refresh().catch(() => {}), REFRESH_MS).unref();
}

module.exports = { getNews, start, refresh, parseClaudeCode, parsePlatform, SOURCES, ENABLED };
