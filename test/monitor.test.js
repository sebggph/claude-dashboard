// Live monitor, weekly plan forecast, workflow runs, session totals with agents.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { agentStatus, monitorView, monitorAlerts, planReading, planForecast, workflowRuns } from '../src/lib/usage.js';
import { recentAgentsOf, agentDays } from '../src/lib/server/usage.js';
import { sessionUsage } from '../src/lib/budget.js';

const PRICING = [{ id: 'claude-opus-5-5', tier: 'std', input: 4, cw5m: 5, cw1h: 8, read: 0.2, output: 20 }];
const bucket = (f) => ({ k: { model: 'claude-opus-5-5', large: false, input: 0, cw5m: 0, cw1h: 0, read: 0, output: 0, ...f } });
const NOW = Date.parse('2026-11-08T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

test('agentStatus: working, idle with countdown, expired, finished; main waits', () => {
  assert.strictEqual(agentStatus({ kind: 'subagent', last: { time: ago(20000) } }, NOW).state, 'working');
  const idle = agentStatus({ kind: 'subagent', last: { time: ago(180000) } }, NOW);
  assert.strictEqual(idle.state, 'idle');
  assert.strictEqual(idle.expiresIn, 120000);
  assert.strictEqual(agentStatus({ kind: 'workflow', last: { time: ago(400000) } }, NOW).state, 'expired');
  assert.strictEqual(agentStatus({ kind: 'subagent', finished: true, last: { time: ago(1000) } }, NOW).state, 'finished');
  assert.strictEqual(agentStatus({ kind: 'main', last: { time: ago(400000) } }, NOW).state, 'waiting');
});

test('monitorView flags big agents and expensive workflow runs; alerts once per item', () => {
  const live = { sessions: [{ id: 's1', title: 'T', project: '/p', agents: [
    { id: 'main', kind: 'main', last: { time: ago(5000), ctx: 90000 }, total: bucket({ read: 1e6 }) },
    { id: 'a1', kind: 'subagent', description: 'Tech', model: 'claude-opus-5-5', last: { time: ago(400000), ctx: 250000 }, total: bucket({ read: 1e6 }) },
    { id: 'w1', kind: 'workflow', workflow: 'wf_1', start: ago(9e5), last: { time: ago(10000), ctx: 50000 }, total: bucket({ output: 2e6 }) },
    { id: 'w2', kind: 'workflow', workflow: 'wf_1', start: ago(8e5), finished: true, last: { time: ago(10000), ctx: 50000 }, total: bucket({ output: 1e5 }) },
  ] }] };
  const v = monitorView(live, PRICING, NOW, { restartAt: 200000, workflowUsd: 25 });
  assert.strictEqual(v.totals.running, 2); // a1 + w1 (main and finished agents don't count)
  assert.strictEqual(v.totals.expired, 1);
  assert.strictEqual(v.totals.restart, 1);
  const a1 = v.sessions[0].rows.find((r) => r.id === 'a1');
  assert.ok(Math.abs(a1.rewriteUsd - 1.25) < 1e-9); // 250K tokens written again at $5/M
  assert.strictEqual(v.workflows[0].agents, 2);
  assert.ok(v.workflows[0].over); // $42 > $25
  assert.deepStrictEqual(monitorAlerts(v).map((a) => a.key), ['restart.a1', 'wf.s1.wf_1']);
});

test('recentAgentsOf goes by the last request, not the file time', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-'));
  const reply = (id, t) => JSON.stringify({ type: 'assistant', timestamp: t, message: { id, model: 'claude-opus-5-5', content: [], usage: { input_tokens: 1, cache_creation_input_tokens: 1000, cache_read_input_tokens: 0, output_tokens: 5 } } });
  const main = path.join(dir, 's.jsonl');
  fs.writeFileSync(main, reply('m1', new Date(Date.now() - 3 * 3600000).toISOString()) + '\n{"type":"ai-title","aiTitle":"x"}\n');
  const sub = path.join(dir, 's', 'subagents', 'agent-1.jsonl');
  fs.mkdirSync(path.dirname(sub), { recursive: true });
  fs.writeFileSync(sub, reply('a1', new Date().toISOString()) + '\n');
  fs.writeFileSync(sub.replace('.jsonl', '.meta.json'), JSON.stringify({ description: 'Tech', finished: true }));
  const got = recentAgentsOf(main, Date.now() - 30 * 60000);
  assert.deepStrictEqual(got.map((a) => [a.kind, a.finished]), [['subagent', true]]); // main: file is new, request is old
  assert.strictEqual(got[0].last.ctx, 1001);
});

test('planReading: a recent status line reading wins; a typed-in reset rolls over weekly', () => {
  const resets = (NOW + 2 * 86400000) / 1000;
  const points = [{ t: ago(3600000), week: { pct: 40, resets } }];
  assert.strictEqual(planReading(points, null, NOW).source, 'statusline');
  const old = [{ t: ago(10 * 3600000), week: { pct: 40, resets } }];
  const manual = { pct: 30, at: ago(7200000), resetsAt: new Date(NOW - 5 * 86400000).toISOString() }; // last week's reset
  const r = planReading(old, manual, NOW);
  assert.strictEqual(r.source, 'manual');
  assert.strictEqual(r.resetsAt, NOW + 2 * 86400000); // moved one week on
  assert.strictEqual(r.pct, 30);
});

test('planForecast learns $ per 1% and projects the pace', () => {
  // Window started 5 days ago; $10 per hour of usage on every hour since then.
  const hours = {};
  for (let h = 5 * 24; h >= 1; h--) hours[new Date(NOW - h * 3600000).toISOString().slice(0, 13)] = { requests: 1, all: bucket({ output: 500000 }), idle: {}, big: {} }; // $10
  const usage = { sessions: [{ id: 's', project: '/p', agents: [{ kind: 'main', hours }] }] };
  const reading = { pct: 60, at: NOW - 3600000, resetsAt: NOW + 2 * 86400000, source: 'statusline' };
  const f = planForecast(usage, reading, PRICING, NOW);
  // $1190 used until the reading = 60% → $19.83 per 1%. One more hour since: +0.5%.
  assert.ok(Math.abs(f.perPct - 1190 / 60) < 1e-6);
  assert.ok(Math.abs(f.pct - (60 + 10 / f.perPct)) < 1e-6);
  // ~0.5% per hour for the 48 hours left → about 85% at the reset, no 100%.
  assert.strictEqual(f.hitAt, null);
  assert.ok(Math.abs(f.atReset - (f.pct + (240 / 24 / f.perPct) * 48)) < 1e-6 && f.atReset > 84 && f.atReset < 86);
  // Twice the pace after a higher reading: 100% comes before the reset.
  const fast = planForecast(usage, { ...reading, pct: 80 }, PRICING, NOW);
  assert.ok(fast.hitAt && fast.hitAt < reading.resetsAt);
  assert.strictEqual(planForecast(usage, null, PRICING, NOW), null);
});

test('workflowRuns: cost per run with its agents', () => {
  const h = { '2026-11-08T10': { requests: 1, all: bucket({ output: 1e6 }) } };
  const usage = { sessions: [{ id: 's', title: 'T', agents: [
    { kind: 'workflow', workflow: 'wf_1', description: 'map 1', start: '2026-11-08T10:00:00Z', hours: h },
    { kind: 'workflow', workflow: 'wf_1', description: 'map 2', start: '2026-11-08T09:00:00Z', hours: h },
    { kind: 'subagent', hours: h },
  ] }] };
  const runs = workflowRuns(usage, ['2026-11-08'], PRICING);
  assert.strictEqual(runs.length, 1);
  assert.strictEqual(runs[0].agents, 2);
  assert.strictEqual(runs[0].usd, 40);
  assert.strictEqual(runs[0].start, '2026-11-08T09:00:00Z');
  assert.deepStrictEqual(runs[0].top, ['map # ×2']);
});

test('session cost and budget include its agents', () => {
  const au = agentDays([{ kind: 'subagent', total: bucket({ output: 1e6 }), hours: {} }]);
  assert.strictEqual(au.tokens, 1e6);
  const s = { totals: { input: 0, cacheWrite: 0, cacheRead: 0, output: 100 }, byModel: [bucket({ output: 1e6 }).k], agentUsage: au };
  assert.strictEqual(sessionUsage(s, 'cost', PRICING), 40);
  assert.strictEqual(sessionUsage(s, 'tokens', PRICING), 1e6 + 100);
});

test('status line logger saves changes only and passes stdin through', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-'));
  const script = path.join(import.meta.dirname, '..', 'scripts', 'statusline-plan-log.mjs');
  const input = JSON.stringify({ model: { display_name: 'Opus' }, rate_limits: { seven_day: { used_percentage: 27.5, resets_at: 1762900000 } } });
  const run = (args = []) => execFileSync(process.execPath, [script, ...args], { input, env: { ...process.env, CLAUDE_DIR: dir } }).toString();
  assert.strictEqual(run(), input); // unchanged for the next command
  assert.strictEqual(run(['--print']), 'week 28%');
  const lines = fs.readFileSync(path.join(dir, 'plan-usage.jsonl'), 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 1); // same values: written once
  assert.deepStrictEqual(JSON.parse(lines[0]).week, { pct: 27.5, resets: 1762900000 });
  // Bad input never breaks the status line.
  assert.strictEqual(execFileSync(process.execPath, [script], { input: 'not json', env: { ...process.env, CLAUDE_DIR: dir } }).toString(), 'not json');
});
