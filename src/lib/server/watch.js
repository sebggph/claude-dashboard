// Watches session transcripts and tells connected browsers when one changes.
// Polls file times every 2 seconds, only while at least one browser listens
// (fs.watch is unreliable on Docker Desktop mounts for Mac and Windows).

import path from 'node:path';
import { sources } from './sessions.js';

const listeners = new Set();
let timer = null;
let last = new Map(); // session id -> "mtime:size"

function snapshot() {
  const m = new Map();
  for (const f of sources().files) {
    const id = path.basename(f.file, '.jsonl');
    const sig = `${f.mtime}:${f.size}`;
    if (!m.has(id) || m.get(id) < sig) m.set(id, sig);
  }
  return m;
}

function tick() {
  const now = snapshot();
  const changed = [];
  for (const [id, sig] of now) if (last.get(id) !== sig) changed.push(id);
  const removed = [...last.keys()].filter((id) => !now.has(id));
  last = now;
  if (changed.length || removed.length) for (const fn of listeners) fn({ changed, removed });
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  if (!listeners.size) { last = snapshot(); timer = setInterval(tick, 2000); }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) { clearInterval(timer); timer = null; }
  };
}
