// Usage per agent: main conversation, subagents, workflow agents.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { forEachLine } from '../src/lib/server/parser.js';
import { scanFile, agentsOf, agentDays } from '../src/lib/server/usage.js';
import { summarize, findingsFor, familyOf, weekDays, fixCommand, shellQuote, deepLink, fixTag, fixTagFor, fixesIn, checkFix, markedFixes, latestFix } from '../src/lib/usage.js';
import { daysOf } from '../src/lib/budget.js';

const PRICING = [{ id: 'claude-opus-5-5', tier: 'std', input: 4, cw5m: 5, cw1h: 8, read: 0.2, output: 20 }];
const u = (cw, cr, out = 10) => ({ input_tokens: 1, cache_creation_input_tokens: cw, cache_read_input_tokens: cr, output_tokens: out });
const reply = (id, time, usage, extra = {}) => ({ type: 'assistant', timestamp: time, ...extra, message: { id, model: 'claude-opus-5-5', content: [], usage } });
const writeJsonl = (file, rows) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); };

test('forEachLine reads lines across chunk borders', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-')), 'a.jsonl');
  const lines = ['short', 'ä'.repeat(50), 'x'.repeat(300), '', 'last-without-newline'];
  fs.writeFileSync(f, lines.join('\n'));
  const got = [];
  forEachLine(f, (l) => got.push(l), 16); // tiny chunks
  assert.deepStrictEqual(got, lines.filter(Boolean));
});

test('scanFile: each request once, idle cache rebuilds and very large contexts', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-')), 's.jsonl');
  writeJsonl(f, [
    reply('m1', '2026-11-02T10:00:00Z', u(30000, 0)),
    reply('m1', '2026-11-02T10:00:00Z', u(30000, 0, 50)), // same request, final usage
    reply('m2', '2026-11-02T10:01:00Z', u(1000, 30000)), // normal: mostly read from cache
    reply('m3', '2026-11-02T10:20:00Z', u(31000, 0)), // after 19 min: rewritten → idle rebuild
    reply('m4', '2026-11-02T10:21:00Z', u(500, 450000)), // > 400K context
    reply('s1', '2026-11-02T10:22:00Z', u(9, 9), { isSidechain: true }), // not part of the main conversation
  ]);
  const s = scanFile(f);
  assert.strictEqual(s.requests, 4);
  const d = s.hours['2026-11-02T10'];
  assert.strictEqual(d.idleCount, 1);
  assert.strictEqual(Object.values(d.idle)[0].cw5m, 31000);
  assert.strictEqual(Object.values(d.idle)[0].read, 0);
  assert.strictEqual(d.bigCount, 1);
  assert.strictEqual(Object.values(d.all).reduce((a, b) => a + b.output, 0), 80);
});

test('agentsOf finds subagents and workflow agents with their descriptions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-'));
  const main = path.join(dir, 'sess.jsonl');
  writeJsonl(main, [reply('a', '2026-11-03T09:00:00Z', u(20000, 0))]);
  const sub = path.join(dir, 'sess', 'subagents', 'agent-1.jsonl');
  writeJsonl(sub, [reply('b', '2026-11-03T09:01:00Z', u(40000, 0), { isSidechain: true })]);
  fs.writeFileSync(sub.replace('.jsonl', '.meta.json'), JSON.stringify({ agentType: 'general-purpose', description: 'Tech agent restart' }));
  const wf = path.join(dir, 'sess', 'subagents', 'workflows', 'wf_1', 'agent-2.jsonl');
  writeJsonl(wf, [reply('c', '2026-11-03T09:02:00Z', u(10000, 0), { isSidechain: true })]);
  const agents = agentsOf(main);
  assert.deepStrictEqual(agents.map((a) => a.kind).sort(), ['main', 'subagent', 'workflow']);
  assert.strictEqual(agents.find((a) => a.kind === 'subagent').description, 'Tech agent restart');
  assert.strictEqual(agents.find((a) => a.kind === 'workflow').workflow, 'wf_1');
  // Agent usage per day, for trends and budgets.
  const au = agentDays(agents);
  assert.strictEqual(au.count, 2);
  assert.strictEqual(au.byDay['2026-11-03'].requests, 2);
  const merged = daysOf({ byDay: { '2026-11-03': { requests: 1, input: 1, cacheWrite: 20000, cacheRead: 0, output: 10, byModel: {} } }, agentUsage: au });
  assert.strictEqual(merged[0][1].requests, 3);
});

test('familyOf groups agents started the same way', () => {
  assert.strictEqual(familyOf({ kind: 'subagent', description: 'Tech review 98 (Domains)' }), 'Tech review #');
  assert.strictEqual(familyOf({ kind: 'subagent', description: 'Tech agent: load memory' }), 'Tech agent');
  assert.strictEqual(familyOf({ kind: 'workflow', type: 'workflow-subagent' }), 'workflow-subagent');
  assert.strictEqual(familyOf({ kind: 'main' }), null);
});

test('summarize and findings: agents, memory loads, growth', () => {
  const day = (all, extra = {}) => ({ requests: 10, all: { k: { model: 'claude-opus-5-5', large: false, input: 0, cw5m: 0, cw1h: 0, read: 0, output: 0, ...all } }, idle: {}, big: {}, idleCount: 0, bigCount: 0, ...extra });
  const usage = { sessions: [{ id: 's', project: '/p', agents: [
    { kind: 'main', hours: { '2026-11-08T10': day({ read: 1e6 }), '2026-10-25T10': day({ read: 1e6 }) } },
    { kind: 'subagent', description: 'Designer agent restart', peak: 300000, hours: { '2026-11-08T11': day({ cw5m: 1e6, read: 5e6 }, { idle: { k: { model: 'claude-opus-5-5', large: false, input: 0, cw5m: 500000, cw1h: 0, read: 0, output: 0 } }, idleCount: 3 }) } },
  ] }] };
  const today = new Date('2026-11-08T12:00:00Z');
  const cur = summarize(usage, weekDays(today, 0), PRICING);
  const prev = summarize(usage, weekDays(today, 2), PRICING);
  assert.strictEqual(weekDays(today, 0)[0], '2026-11-02');
  assert.strictEqual(weekDays(today, 2)[6], '2026-10-25');
  assert.ok(cur.agentShare > 0.9);
  assert.strictEqual(cur.loads.count, 1);
  assert.strictEqual(cur.idle.count, 3);
  const ids = findingsFor(cur, prev).map((f) => f.id);
  assert.strictEqual(ids[0], 'growth');
  for (const id of ['memory_loads', 'idle_rebuilds', 'agents_share']) assert.ok(ids.includes(id), id);
  assert.strictEqual(findingsFor(cur, prev).find((f) => f.id === 'memory_loads').project, '/p');
});

test('fix command quotes the project and the prompt for the shell', () => {
  assert.strictEqual(shellQuote("it's"), `'it'\\''s'`);
  assert.strictEqual(fixCommand('/a b', 'hi'), `cd '/a b' && claude 'hi'`);
  assert.strictEqual(fixCommand(null, 'hi'), `claude 'hi'`);
});

test('deep link opens Claude Code in the project with the prompt typed in', () => {
  const l = deepLink('/Users/me/my app', 'fix this\nplease & thanks');
  assert.strictEqual(l, 'claude-cli://open?cwd=%2FUsers%2Fme%2Fmy%20app&q=fix%20this%0Aplease%20%26%20thanks');
  assert.ok(deepLink('C:\\code\\app', 'hi'));
  assert.strictEqual(deepLink(null, 'hi'), null); // no folder: copy the command instead
  assert.strictEqual(deepLink('relative/path', 'hi'), null);
  assert.strictEqual(deepLink('/p', 'x'.repeat(5001)), null); // over the 5,000-character limit
});

test('fix sessions are found by the tag at the start of the prompt', () => {
  assert.strictEqual(fixTag(fixTagFor('memory_loads') + ' The Claude Context Dashboard measured…'), 'memory_loads');
  assert.strictEqual(fixTag('please fix [Dashboard fix: memory_loads]'), null); // only at the start
  assert.strictEqual(fixTag('[Dashboard fix: rm_rf]'), null); // unknown ids are ignored
  const fixes = fixesIn({ sessions: [{ id: 'a', fix: null }, { id: 'b', fix: 'idle_rebuilds', project: '/p', start: '2026-11-09T10:00:00Z' }] });
  assert.deepStrictEqual(fixes.map((f) => [f.id, f.session]), [['idle_rebuilds', 'b']]);
});

test('checkFix compares the share before and after the fix session', () => {
  const opus = (f) => ({ k: { model: 'claude-opus-5-5', large: false, input: 0, cw5m: 0, cw1h: 0, read: 0, output: 0, ...f } });
  const hour = (all, requests = 30) => ({ requests, all: opus(all), idle: {}, big: {}, idleCount: 0, bigCount: 0 });
  const loader = (h, n) => ({ kind: 'subagent', description: 'Tech agent restart', hours: { [h]: hour({ read: n }) } });
  const worker = (h, n) => ({ kind: 'subagent', description: 'Port charts', hours: { [h]: hour({ read: n }) } });
  const main = (hours) => ({ kind: 'main', hours });
  const fix = { id: 'memory_loads', project: '/p', session: 'fix', start: '2026-11-09T10:30:00Z' };
  const base = [
    { id: 'old', project: '/p', agents: [main({ '2026-11-08T10': hour({ read: 1e6 }) }), loader('2026-11-08T11', 9e6)] },
    // The fix session itself (its own agents) is left out.
    { id: 'fix', project: '/p', agents: [main({ '2026-11-09T11': hour({ read: 1e6 }) }), loader('2026-11-09T11', 9e6)] },
    // Another project never counts.
    { id: 'other', project: '/q', agents: [loader('2026-11-09T12', 9e6)] },
  ];
  const now = new Date('2026-11-09T20:00:00Z');
  // Too little since the fix: wait.
  assert.strictEqual(checkFix({ sessions: base }, fix, PRICING, now).status, 'waiting');
  // Work since the fix without memory reloads: fixed.
  const good = [...base, { id: 'new', project: '/p', agents: [main({ '2026-11-09T12': hour({ read: 1e6 }) }), worker('2026-11-09T12', 2e6), worker('2026-11-09T13', 2e6), worker('2026-11-09T14', 2e6)] }];
  const ok = checkFix({ sessions: good }, fix, PRICING, now);
  assert.strictEqual(ok.status, 'fixed');
  assert.ok(ok.before > 0.8 && ok.after === 0);
  // Reloads still happening: still.
  const bad = [...base, { id: 'new', project: '/p', agents: [main({ '2026-11-09T12': hour({ read: 1e6 }) }), loader('2026-11-09T12', 9e6), loader('2026-11-09T13', 9e6), worker('2026-11-09T14', 1e6)] }];
  assert.strictEqual(checkFix({ sessions: bad }, fix, PRICING, now).status, 'still');
  // Without prices nothing can be judged.
  assert.strictEqual(checkFix({ sessions: good }, fix, null, now).status, 'waiting');
});

test('fixes marked by hand join the fix list; the latest one counts', () => {
  const marks = markedFixes({ 'memory_loads|/a b|c': '2026-11-09T12:00:00Z', 'nope|/p': '2026-11-09T12:00:00Z' });
  assert.deepStrictEqual(marks.map((f) => [f.id, f.project, f.manual]), [['memory_loads', '/a b|c', true]]);
  const tagged = { id: 'memory_loads', project: '/a b|c', session: 's', start: '2026-11-09T10:00:00Z' };
  assert.strictEqual(latestFix([tagged, ...marks], 'memory_loads', '/a b|c').manual, true);
});

test('waiting agents only: main conversations do not count as idle rebuilds', () => {
  const b = (cw) => ({ k: { model: 'claude-opus-5-5', large: false, input: 0, cw5m: cw, cw1h: 0, read: 0, output: 0 } });
  const h = (idle) => ({ requests: 1, all: b(1e6), idle: b(idle), big: {}, idleCount: idle ? 1 : 0, bigCount: 0 });
  const usage = { sessions: [{ id: 's', project: '/p', agents: [{ kind: 'main', hours: { '2026-11-08T10': h(1e6) } }, { kind: 'subagent', description: 'x', hours: { '2026-11-08T10': h(0) } }] }] };
  const s = summarize(usage, ['2026-11-08'], PRICING);
  assert.strictEqual(s.idle.count, 0);
  assert.strictEqual(s.idle.usd, 0);
});
