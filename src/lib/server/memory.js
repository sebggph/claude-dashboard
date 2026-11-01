// Finds the memory files Claude Code loads for a session, following the
// official rules (https://code.claude.com/docs/en/memory):
// - ~/.claude/CLAUDE.md and ~/.claude/rules/**/*.md (user scope)
// - CLAUDE.md and CLAUDE.local.md in the working directory and every folder above it
// - ./.claude/CLAUDE.md and ./.claude/rules/**/*.md (rules with `paths:` load on demand)
// - AGENTS.md when there's no CLAUDE.md / CLAUDE.local.md in the working directory or above
// - @path imports (relative to the importing file, up to 4 hops)
// - Auto memory: ~/.claude/projects/<project>/memory/MEMORY.md (first 200 lines / 25 KB)
//
// Project folders are only readable when the dashboard can see them: always
// when run with `npm start`, and in Docker when you mount your code folder
// (PROJECTS_DIR inside the container + PROJECTS_HOST_DIR = the same folder on
// your computer). Everything is read-only.

import fs from 'node:fs';
import path from 'node:path';
import { est } from './parser.js';

const PROSE_FACTOR = 1.18; // same calibration as the parser for plain text
const MAX_FILE = 512 * 1024; // ignore huge files
const tokens = (text) => Math.round(est(text) * PROSE_FACTOR);

const HOST_DIR = process.env.PROJECTS_HOST_DIR ? norm(process.env.PROJECTS_HOST_DIR) : null;
const MOUNT_DIR = process.env.PROJECTS_DIR || null;

function norm(p) {
  return String(p).replace(/\\/g, '/').replace(/\/+$/, '');
}

/** Map a transcript's working directory to a path we can read, or null. */
export function resolveProjectPath(cwd) {
  if (!cwd) return null;
  const n = norm(cwd);
  if (HOST_DIR && MOUNT_DIR) {
    const a = n.toLowerCase(), b = HOST_DIR.toLowerCase();
    if (a === b || a.startsWith(b + '/')) {
      const p = path.join(MOUNT_DIR, n.slice(HOST_DIR.length));
      return exists(p) ? { path: p, root: MOUNT_DIR } : null;
    }
  }
  return exists(cwd) ? { path: cwd, root: path.parse(path.resolve(cwd)).root } : null;
}

function exists(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function readText(p) {
  try {
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > MAX_FILE) return null;
    return fs.readFileSync(p, 'utf8');
  } catch { return null; }
}

// "@path" imports outside code spans and fenced blocks.
function importsOf(text) {
  const out = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const clean = line.replace(/`[^`]*`/g, '');
    for (const m of clean.matchAll(/(?:^|\s)@((?:\\ |[^\s])+)/g)) out.push(m[1].replace(/\\ /g, ' '));
  }
  return out;
}

function hasPathsFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return !!(m && /^paths\s*:/m.test(m[1]));
}

function listMd(dir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMd(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

/**
 * @param {{ cwd: string, projectDir: string, claudeDir: string }} s
 */
export function memoryFor({ cwd, projectDir, claudeDir }) {
  const files = [];
  const seen = new Set();
  const project = resolveProjectPath(cwd);
  const display = (p) => {
    if (p.startsWith(claudeDir)) return '~/.claude' + norm(p.slice(claudeDir.length));
    if (project && MOUNT_DIR && p.startsWith(MOUNT_DIR)) return HOST_DIR + norm(p.slice(MOUNT_DIR.length));
    return norm(p);
  };

  function add(p, scope, loads, depth = 0, via = null) {
    const key = path.resolve(p);
    if (seen.has(key)) return;
    const text = readText(p);
    if (text == null) return;
    seen.add(key);
    const lines = text.split('\n').length;
    files.push({ path: display(p), scope, loads, lines, tokens: tokens(text), via, tooLong: lines > 200 });
    if (depth >= 4) return;
    for (const imp of importsOf(text)) {
      let target = imp;
      if (target.startsWith('~/.claude/')) target = path.join(claudeDir, target.slice(10));
      else if (target.startsWith('~')) continue; // other home paths aren't visible here
      else if (!path.isAbsolute(target)) target = path.resolve(path.dirname(p), target);
      add(target, scope, loads, depth + 1, display(p));
    }
  }

  // User scope.
  add(path.join(claudeDir, 'CLAUDE.md'), 'user', 'start');
  for (const r of listMd(path.join(claudeDir, 'rules'))) {
    const text = readText(r);
    if (text != null) add(r, 'user', hasPathsFrontmatter(text) ? 'on demand' : 'start');
  }

  // Project scope: the working directory and every folder above it.
  if (project) {
    const chain = [];
    let dir = path.resolve(project.path);
    const stop = path.resolve(project.root);
    for (;;) {
      chain.unshift(dir);
      if (dir === stop || path.dirname(dir) === dir) break;
      dir = path.dirname(dir);
    }
    let anyClaude = false;
    for (const d of chain) {
      const isCwd = d === path.resolve(project.path);
      for (const name of ['CLAUDE.md', 'CLAUDE.local.md']) {
        const p = path.join(d, name);
        if (readText(p) != null) { anyClaude = true; add(p, isCwd ? 'project' : 'parent folder', 'start'); }
      }
      if (isCwd) {
        const p = path.join(d, '.claude', 'CLAUDE.md');
        if (readText(p) != null) { anyClaude = true; add(p, 'project', 'start'); }
        for (const r of listMd(path.join(d, '.claude', 'rules'))) {
          const text = readText(r);
          if (text != null) add(r, 'project rule', hasPathsFrontmatter(text) ? 'on demand' : 'start');
        }
      }
    }
    if (!anyClaude) for (const d of chain) add(path.join(d, 'AGENTS.md'), 'AGENTS.md', 'start');
  }

  // Auto memory: only the first 200 lines / 25 KB load at start.
  const mem = path.join(claudeDir, 'projects', projectDir || '', 'memory', 'MEMORY.md');
  const memText = projectDir ? readText(mem) : null;
  if (memText != null) {
    const loaded = memText.split('\n').slice(0, 200).join('\n').slice(0, 25 * 1024);
    files.push({ path: display(mem), scope: 'auto memory', loads: 'start', lines: memText.split('\n').length, tokens: tokens(loaded), via: null, tooLong: false });
  }

  const atStart = files.filter((f) => f.loads === 'start').reduce((a, f) => a + f.tokens, 0);
  return { files, atStart, projectReadable: !!project };
}
