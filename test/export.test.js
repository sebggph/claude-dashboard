// Export helpers. Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { csvCell, toCSV, breakdownCSV, timelineCSV, sessionJSON } from '../src/lib/export.js';

const noMask = { on: false, text: (x) => x, title: (s) => s.title, project: (p) => p, path: (p) => p };
const mask = { on: true, text: () => '', title: () => 'Session abc123', project: () => 'Project K7', path: (p) => '…/' + p.split('/').pop() };
const s = {
  id: 'abc', title: 'Fix login', project: '/Users/me/app', gitBranch: 'main', file: '/Users/me/.claude/x.jsonl', contextTokens: 50000,
  breakdown: { fixed: { system_prompt: 5000, mcp_tools: 10000 }, categories: { tool_results: 30000, user: 5000 } },
  timeline: [{ time: 't1', total: 20000, cacheRead: 0, cacheWrite: 20000, output: 100 }, { time: 't2', total: 50000, cacheRead: 20000, cacheWrite: 30000, output: 200 }],
  steps: [{ delta: 20000, top: [] }, { delta: 30000, compacted: false, prompt: 'secret plan', top: [{ cat: 'tool_results', tool: 'Bash', label: '=cmd|calc', tokens: 29000 }] }],
  biggest: [{ label: 'secret.txt' }], memory: { files: [{ path: '/Users/me/app/CLAUDE.md' }] },
};

test('CSV cells: quoting and formula defusing', () => {
  assert.strictEqual(csvCell('a,b'), '"a,b"');
  assert.strictEqual(csvCell('say "hi"'), '"say ""hi"""');
  assert.strictEqual(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.strictEqual(csvCell('@cmd'), "'@cmd");
  assert.strictEqual(csvCell(-42), '-42');
  assert.strictEqual(toCSV([['a', 1], ['b', 2]]), 'a,1\r\nb,2\r\n');
});

test('breakdown and timeline CSV', () => {
  const b = breakdownCSV(s, 100000).split('\r\n');
  assert.strictEqual(b[0], 'group,part,tokens,share_of_window');
  assert.ok(b.includes('setup,mcp_tools,10000,0.1000'));
  assert.ok(b.includes('total,context_used,50000,0.5000'));
  const tl = timelineCSV(s, noMask).split('\r\n');
  assert.strictEqual(tl[2], '2,t2,50000,30000,20000,30000,200,,Bash =cmd|calc,29000');
});

test('JSON drops local paths and masks private text', () => {
  const plain = JSON.parse(sessionJSON(s, noMask));
  assert.strictEqual(plain.file, undefined);
  assert.strictEqual(plain.title, 'Fix login');
  const priv = JSON.parse(sessionJSON(s, mask));
  assert.strictEqual(priv.title, 'Session abc123');
  assert.strictEqual(priv.project, 'Project K7');
  assert.strictEqual(priv.steps[1].prompt, null);
  assert.strictEqual(priv.biggest[0].label, '');
  assert.strictEqual(priv.memory.files[0].path, '…/CLAUDE.md');
});
