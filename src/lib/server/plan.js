// Plan usage (5-hour and weekly %) saved by scripts/statusline-plan-log.mjs
// from Claude Code's status line. Read-only; the file is optional.
import fs from 'node:fs';
import path from 'node:path';
import { forEachLine } from './parser.js';

/** Points [{ t, five: {pct, resets}, week: {pct, resets} }], oldest first, last 14 days. */
export function planUsage(claudeDir) {
  const file = path.join(claudeDir, 'plan-usage.jsonl');
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const out = [];
  try {
    forEachLine(file, (line) => {
      try { const p = JSON.parse(line); if (p.t >= since && (p.week || p.five)) out.push(p); } catch { /* skip */ }
    });
  } catch { return []; }
  return out;
}
