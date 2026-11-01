// Budget checks. Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { status, usageOn, budgetReport, lastDays } from '../src/lib/budget.js';

const pricing = [{ id: 'claude-opus-5-5', tier: 'std', input: 4, cw5m: 5, cw1h: 8, read: 0.2, output: 20 }];
const day = (input, output) => ({ requests: 1, input, cacheWrite: 0, cacheRead: 0, output, byModel: { k: { model: 'claude-opus-5-5', large: false, input, cw5m: 0, cw1h: 0, read: 0, output } } });
const now = new Date('2026-11-01T12:00:00Z');
const sessions = [
  { id: 'a', totals: { input: 1e6, cacheWrite: 0, cacheRead: 0, output: 1e6 }, byModel: [{ model: 'claude-opus-5-5', input: 1e6, cw5m: 0, cw1h: 0, read: 0, output: 1e6 }],
    byDay: { '2026-11-01': day(1e6, 0), '2026-10-28': day(0, 1e6) } },
];

test('levels: ok, near (80%+), over', () => {
  assert.strictEqual(status(5, 10).level, 'ok');
  assert.strictEqual(status(8, 10).level, 'near');
  assert.strictEqual(status(10, 10).level, 'over');
  assert.strictEqual(status(5, null).level, 'none');
});

test('usage per day and week, in dollars and tokens', () => {
  assert.strictEqual(usageOn(sessions, ['2026-11-01'], 'cost', pricing), 4); // 1M input × $4
  assert.strictEqual(usageOn(sessions, lastDays(7, now), 'cost', pricing), 24); // + 1M output × $20
  assert.strictEqual(usageOn(sessions, ['2026-11-01'], 'tokens', pricing), 1e6);
});

test('report: today near, week over, sessions over', () => {
  const r = budgetReport(sessions, { unit: 'cost', daily: 5, weekly: 20, session: 10 }, pricing, now);
  assert.strictEqual(r.today.level, 'near');
  assert.strictEqual(r.week.level, 'over');
  assert.strictEqual(r.sessionsOver, 1);
});
