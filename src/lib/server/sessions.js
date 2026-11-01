// Finds Claude Code session transcripts and parses them (read-only).
// Parsed results are cached and re-parsed only when a file changes.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSession, parseSubagents, est } from './parser.js';
import { APP_ROOT } from './paths.js';
import { memoryFor } from './memory.js';

export const CLAUDE_DIR = process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude');
const DEMO_DIR = path.join(APP_ROOT, 'samples');
const FORCE_DEMO = process.env.DEMO === '1' || process.argv.includes('--demo');

export const projectsDir = () => path.join(CLAUDE_DIR, 'projects');

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
// (permissions), 'empty' (no sessions yet) or 'forced' (DEMO=1 / --demo).
export function folderStatus() {
  if (FORCE_DEMO) return 'forced';
  try { fs.readdirSync(projectsDir()); return 'ok'; } catch (e) {
    return e.code === 'EACCES' || e.code === 'EPERM' ? 'unreadable' : 'missing';
  }
}

export function sources() {
  const real = FORCE_DEMO ? [] : listSessionFiles(projectsDir());
  if (real.length) return { demo: false, files: real };
  const status = folderStatus();
  return { demo: true, reason: status === 'ok' ? 'empty' : status, files: listSessionFiles(DEMO_DIR) };
}

const cache = new Map();
function cached(entry) {
  const hit = cache.get(entry.file);
  if (hit && hit.mtime === entry.mtime && hit.size === entry.size) return hit.value;
  let value = null;
  try { value = parseSession(entry.file, { full: true }); } catch { value = null; }
  if (value) value.projectDir = entry.projectDir;
  cache.set(entry.file, { mtime: entry.mtime, size: entry.size, value });
  return value;
}

function memoryFiles() {
  // The user-level memory file is inside the mounted folder; project files are not.
  const out = [];
  try {
    const txt = fs.readFileSync(path.join(CLAUDE_DIR, 'CLAUDE.md'), 'utf8');
    out.push({ path: '~/.claude/CLAUDE.md', tokens: est(txt), lines: txt.split('\n').length });
  } catch { /* none */ }
  return out;
}

/** All sessions (light fields only), newest first. */
export function listSessions() {
  const { demo, reason, files } = sources();
  const byId = new Map();
  for (const f of files) {
    const full = cached(f);
    if (!full || !full.requests) continue; // skip sessions with no Claude replies
    const { timeline, biggest, tools, ...s } = full;
    s.mcpServers = [...new Set(tools.map((t) => t.server).filter(Boolean))];
    s.mtime = f.mtime;
    // The same session can be written under two project folders (cwd changed);
    // keep the most recently updated copy.
    const prev = byId.get(s.id);
    if (!prev || prev.mtime < s.mtime) byId.set(s.id, s);
  }
  const sessions = [...byId.values()].sort((a, b) => String(b.end).localeCompare(String(a.end)));
  return {
    demo,
    demoReason: demo ? reason : null,
    claudeDir: demo ? null : CLAUDE_DIR,
    memoryFiles: demo ? [] : memoryFiles(),
    generated: new Date().toISOString(),
    sessions,
  };
}

/** One session with the full breakdown, or null. */
export function getSession(id) {
  if (!/^[\w.-]+$/.test(id)) return null;
  const { files } = sources();
  const matches = files.filter((f) => path.basename(f.file, '.jsonl') === id).sort((a, b) => b.mtime - a.mtime);
  if (!matches.length) return null;
  const detail = cached(matches[0]);
  if (!detail) return null;
  // Memory files are read fresh each time (they change independently of the transcript).
  const memory = memoryFor({ cwd: detail.project, projectDir: matches[0].projectDir, claudeDir: CLAUDE_DIR });
  const fixed = { ...detail.breakdown.fixed };
  const restKey = 'tools_other' in fixed ? 'tools_other' : 'fixed_overhead';
  const mem = Math.min(memory.atStart, fixed[restKey] || 0);
  if (mem > 0) {
    fixed.memory_files = mem;
    fixed[restKey] -= mem;
    if (restKey === 'fixed_overhead') { fixed.tools_other = fixed.fixed_overhead; delete fixed.fixed_overhead; }
  }
  return {
    ...detail,
    breakdown: { ...detail.breakdown, fixed },
    memory,
    subagents: parseSubagents(matches[0].file),
  };
}

export function describeSource() {
  const { demo, files } = sources();
  const why = { unreadable: 'the folder exists but is not readable (permissions)', missing: 'the folder was not found', empty: 'it has no sessions yet', forced: 'demo mode is on' };
  const st = folderStatus();
  return demo
    ? `Showing demo data: ${projectsDir()}: ${why[st === 'ok' ? 'empty' : st]}.`
    : `Reading ${files.length} session files from ${projectsDir()}`;
}
