#!/usr/bin/env node
// Saves your plan usage (5-hour and weekly %) from Claude Code's status line
// so the dashboard can show it and forecast your week. Claude Code sends the
// status line a JSON object on stdin; for Pro, Max and Ultra subscribers it
// has `rate_limits` (https://code.claude.com/docs/en/statusline).
//
// It passes stdin through unchanged, so it goes in front of your own status
// line command:
//   "statusLine": { "type": "command",
//     "command": "node /path/to/claude-dashboard/scripts/statusline-plan-log.mjs | sh ~/.claude/statusline-context.sh" }
// Without a status line of your own, add --print to show the weekly % instead.
//
// Writes one line to ~/.claude/plan-usage.jsonl when a value changes
// (CLAUDE_DIR overrides the folder). Never fails the status line.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const raw = Buffer.concat(chunks).toString('utf8');
const print = process.argv.includes('--print');

let line = '';
try {
  const rl = JSON.parse(raw).rate_limits || {};
  const pick = (w) => (w && typeof w.used_percentage === 'number' ? { pct: w.used_percentage, resets: w.resets_at || null } : null);
  const entry = { five: pick(rl.five_hour), week: pick(rl.seven_day) };
  if (entry.five || entry.week) {
    if (entry.week) line = `week ${Math.round(entry.week.pct)}%`;
    const file = path.join(process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude'), 'plan-usage.jsonl');
    const key = JSON.stringify(entry);
    const state = file + '.last';
    let last = '';
    try { last = fs.readFileSync(state, 'utf8'); } catch { /* first run */ }
    if (last !== key) {
      fs.appendFileSync(file, JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n');
      fs.writeFileSync(state, key);
    }
  }
} catch { /* never break the status line */ }

process.stdout.write(print ? line : raw);
