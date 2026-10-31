// Claude Context Dashboard: a tiny web server with no dependencies.
// It reads Claude Code transcripts from CLAUDE_DIR (read-only) and serves
// the dashboard UI plus a small JSON API.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseSession, parseSubagents, est } = require('./parser');
const news = require('./news');
const live = require('./live');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const CLAUDE_DIR = process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude');
const DEMO_DIR = path.join(ROOT, 'samples');
const FORCE_DEMO = process.env.DEMO === '1' || process.argv.includes('--demo');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// ---------- session discovery ----------

function projectsDir() {
  return path.join(CLAUDE_DIR, 'projects');
}

function listSessionFiles(base) {
  const out = [];
  let projects = [];
  try { projects = fs.readdirSync(base, { withFileTypes: true }); } catch { return out; }
  for (const p of projects) {
    if (!p.isDirectory()) continue;
    const dir = path.join(base, p.name);
    let files = [];
    try { files = fs.readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const full = path.join(dir, f);
      try {
        const st = fs.statSync(full);
        if (st.size > 0) out.push({ file: full, projectDir: p.name, mtime: st.mtimeMs, size: st.size });
      } catch { /* file vanished */ }
    }
  }
  return out;
}

// Why we fell back to demo data: 'missing' (no folder), 'unreadable'
// (permissions), 'empty' (no sessions yet) or 'forced' (DEMO=1).
function folderStatus() {
  if (FORCE_DEMO) return 'forced';
  try { fs.readdirSync(projectsDir()); return 'ok'; } catch (e) {
    return e.code === 'EACCES' || e.code === 'EPERM' ? 'unreadable' : 'missing';
  }
}

function sources() {
  const real = FORCE_DEMO ? [] : listSessionFiles(projectsDir());
  if (real.length) return { demo: false, files: real };
  const status = folderStatus();
  return { demo: true, reason: status === 'ok' ? 'empty' : status, files: listSessionFiles(DEMO_DIR) };
}

// Cache parsed results; re-parse only when a file changes.
const cache = new Map();
function cached(entry, full) {
  const key = entry.file + (full ? ':full' : ':sum');
  const hit = cache.get(key);
  if (hit && hit.mtime === entry.mtime && hit.size === entry.size) return hit.value;
  let value;
  try { value = parseSession(entry.file, { full }); } catch (e) { value = null; }
  if (value) value.projectDir = entry.projectDir;
  cache.set(key, { mtime: entry.mtime, size: entry.size, value });
  return value;
}

function allSummaries() {
  const { demo, files } = sources();
  const byId = new Map();
  for (const f of files) {
    const full = cached(f, true);
    if (!full || !full.requests) continue; // skip sessions with no Claude replies
    // The list view only needs the light fields.
    const { timeline, biggest, tools, ...s } = full;
    s.mcpServers = [...new Set(tools.map((t) => t.server).filter(Boolean))];
    s.mtime = f.mtime;
    // The same session can be written under two project folders (cwd changed);
    // keep the most recently updated copy.
    const prev = byId.get(s.id);
    if (!prev || prev.mtime < s.mtime) byId.set(s.id, s);
  }
  const sessions = [...byId.values()].sort((a, b) => String(b.end).localeCompare(String(a.end)));
  return { demo, sessions };
}

function memoryFiles() {
  // The user-level memory file is inside the mounted folder; project files are not.
  const out = [];
  const p = path.join(CLAUDE_DIR, 'CLAUDE.md');
  try {
    const txt = fs.readFileSync(p, 'utf8');
    out.push({ path: '~/.claude/CLAUDE.md', tokens: est(txt), lines: txt.split('\n').length });
  } catch { /* none */ }
  return out;
}

// ---------- http ----------

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function serveStatic(res, baseDir, rel) {
  const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(baseDir, safe);
  if (!full.startsWith(baseDir)) return send(res, 403, { error: 'forbidden' });
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'not found' });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(full).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);

  if (req.method !== 'GET') return send(res, 405, { error: 'read-only' });

  if (p === '/api/health') return send(res, 200, { ok: true });

  if (p === '/api/live') return send(res, 200, live.getLive());

  if (p === '/api/news') {
    news.getNews({ force: url.searchParams.get('refresh') === '1' })
      .then((n) => send(res, 200, n))
      .catch((e) => send(res, 500, { error: String(e.message || e) }));
    return;
  }

  if (p === '/api/sessions') {
    const { demo, sessions } = allSummaries();
    return send(res, 200, {
      demo,
      demoReason: demo ? sources().reason : null,
      claudeDir: demo ? null : CLAUDE_DIR,
      memoryFiles: demo ? [] : memoryFiles(),
      generated: new Date().toISOString(),
      sessions,
    });
  }

  const m = p.match(/^\/api\/sessions\/([\w.-]+)$/);
  if (m) {
    const { files } = sources();
    const matches = files.filter((f) => path.basename(f.file, '.jsonl') === m[1]).sort((a, b) => b.mtime - a.mtime);
    if (!matches.length) return send(res, 404, { error: 'session not found' });
    const detail = cached(matches[0], true);
    if (!detail) return send(res, 500, { error: 'could not read session' });
    return send(res, 200, { ...detail, subagents: parseSubagents(matches[0].file) });
  }

  if (p.startsWith('/docs/')) return serveStatic(res, path.join(ROOT, 'docs'), p.slice(6));
  if (p === '/' || p === '/index.html') return serveStatic(res, path.join(ROOT, 'public'), 'index.html');
  return serveStatic(res, path.join(ROOT, 'public'), p.slice(1));
});

news.start();
live.start();

server.listen(PORT, HOST, () => {
  const { demo, files } = sources();
  console.log(`Claude Context Dashboard → http://localhost:${PORT}`);
  const why = { unreadable: 'the folder exists but is not readable (permissions)', missing: 'the folder was not found', empty: 'it has no sessions yet', forced: 'DEMO=1 is set' };
  console.log(demo
    ? `Showing demo data: ${projectsDir()}: ${why[folderStatus() === 'ok' ? 'empty' : folderStatus()]}.`
    : `Reading ${files.length} session files from ${projectsDir()}`);
});
