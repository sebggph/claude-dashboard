// Run: npm test  (uses Node's built-in test runner)
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSession } from '../src/lib/server/parser.js';

function write(rows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-'));
  const f = path.join(dir, 'abc.jsonl');
  fs.writeFileSync(f, rows.map((r) => JSON.stringify(r)).join('\n') + '\n{"partial":');
  return f;
}
const usage = (cw, cr, out, think = 0) => ({ input_tokens: 2, cache_creation_input_tokens: cw, cache_read_input_tokens: cr, output_tokens: out, output_tokens_details: { thinking_tokens: think } });

test('counts each request once and uses input tokens for context', () => {
  const f = write([
    { type: 'user', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'hello there' } },
    { type: 'assistant', timestamp: '2026-01-01T00:00:01Z', message: { id: 'm1', model: 'claude-opus-5-5', content: [{ type: 'thinking', thinking: '' }], usage: usage(20000, 0, 100, 40) } },
    { type: 'assistant', timestamp: '2026-01-01T00:00:01Z', message: { id: 'm1', model: 'claude-opus-5-5', content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.js' } }], usage: usage(20000, 0, 100, 40) } },
    { type: 'user', timestamp: '2026-01-01T00:00:02Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'x'.repeat(4000) }] } },
    { type: 'assistant', timestamp: '2026-01-01T00:00:03Z', message: { id: 'm2', model: 'claude-opus-5-5', content: [{ type: 'text', text: 'done' }], usage: usage(1500, 20002, 50) } },
  ]);
  const s = parseSession(f);
  assert.strictEqual(s.requests, 2);
  assert.strictEqual(s.contextTokens, 2 + 1500 + 20002);
  assert.strictEqual(s.totals.output, 150);
  assert.strictEqual(s.userPrompts, 1);
  assert.strictEqual(s.tools[0].name, 'Read');
  // Parts add up to the measured total.
  const sum = Object.values(s.breakdown.categories).reduce((a, v) => a + v, 0) + s.breakdown.fixedTotal;
  assert.ok(Math.abs(sum - s.contextTokens) <= 5, `sum ${sum} vs ${s.contextTokens}`);
  // Thinking gets its measured output share.
  assert.strictEqual(s.breakdown.categories.thinking, 40);
});

test('tracks compactions', () => {
  const f = write([
    { type: 'assistant', timestamp: '2026-01-01T00:00:01Z', message: { id: 'a', content: [], usage: usage(90000, 0, 10) } },
    { type: 'system', subtype: 'compact_boundary', timestamp: '2026-01-01T00:00:02Z', compactMetadata: { trigger: 'auto', preTokens: 90000 } },
    { type: 'user', isCompactSummary: true, message: { role: 'user', content: 'summary '.repeat(200) } },
    { type: 'assistant', timestamp: '2026-01-01T00:00:03Z', message: { id: 'b', content: [], usage: usage(25000, 0, 10) } },
  ]);
  const s = parseSession(f);
  assert.strictEqual(s.compactions, 1);
  assert.strictEqual(s.peakTokens, 90002);
  assert.ok(s.breakdown.categories.compact_summary > 0);
});
