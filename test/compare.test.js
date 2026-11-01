// Session comparison. Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { setupOf, conversationOf, delta, setupChanges, toolsCompared } from '../src/lib/compare.js';

const mk = (fixed, cats, tools = []) => ({ breakdown: { fixed, categories: cats }, tools });
const a = mk({ system_prompt: 5000, mcp_tools: 20000, tools_other: 15000 }, { skills: 6000, mcp_instructions: 800, user: 1000, tool_results: 9000 }, [{ name: 'Read', calls: 3, callTokens: 100, resultTokens: 4000 }]);
const b = mk({ system_prompt: 5000, mcp_tools: 2000, memory_files: 1200, tools_other: 15000 }, { skills: 6000, user: 1500, tool_results: 3000 }, [{ name: 'Bash', calls: 2, callTokens: 50, resultTokens: 900 }]);

test('splits setup and conversation', () => {
  assert.strictEqual(setupOf(a).total, 5000 + 20000 + 15000 + 6000 + 800);
  assert.strictEqual(setupOf(b).parts.memory_files, 1200);
  assert.strictEqual(conversationOf(a).total, 10000);
});

test('delta verdicts', () => {
  assert.strictEqual(delta(100, 50).verdict, 'better');
  assert.strictEqual(delta(100, 150).verdict, 'worse');
  assert.strictEqual(delta(0.8, 0.95, 'higher').verdict, 'better');
  assert.strictEqual(delta(100, 101).verdict, 'same');
  assert.strictEqual(delta(5, 9, null).verdict, 'same');
});

test('biggest setup changes first', () => {
  const c = setupChanges(a, b);
  assert.deepStrictEqual(c.map((x) => x.key), ['mcp_tools', 'memory_files', 'listings']);
  assert.strictEqual(c[0].diff, -18000);
});

test('tools from both sessions', () => {
  assert.deepStrictEqual(toolsCompared(a, b).map((x) => x.name), ['Read', 'Bash']);
});
