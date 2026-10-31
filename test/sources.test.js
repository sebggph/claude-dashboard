// Parsers for the official news and models pages. Run: npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseClaudeCode, parsePlatform } = require('../server/news');
const { parseModels } = require('../server/live');

test('parses the Claude Code changelog page', () => {
  const md = `# Claude Code changelog\n\n**2.1.316**\n\nOctober 31, 2026\n\n**Added**\n\n* Added \`/foo\` to compact faster\n* \\[VSCode] Added a thing\n\n**3 bug fixes**\n\n* Fixed the context window size\n\n**2.1.315**\n\nOctober 30, 2026\n\n* Fixed something`;
  const r = parseClaudeCode(md);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].version, '2.1.316');
  assert.strictEqual(r[0].date, '2026-10-31');
  assert.deepStrictEqual(r[0].groups.map((g) => g.type), ['added', 'fixed']);
  assert.ok(r[0].groups[0].items[0].tags.includes('context'));
  assert.strictEqual(r[0].groups[0].items[1].text, '[VSCode] Added a thing');
});

test('parses the Platform release notes and skips MDX blocks', () => {
  const md = `<Tip>\n  * not an item\n</Tip>\n\n### October 30, 2026\n\n* We’ve deprecated fast mode for Opus 4.8.\n\n### October 29, 2026\n\n* Launched a thing`;
  const r = parsePlatform(md);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].groups[0].items[0].text, 'Deprecated fast mode for Opus 4.8.');
  assert.ok(r[0].groups[0].items[0].tags.includes('deprecation'));
});

test('parses the models comparison table', () => {
  const md = `## Compare models\n\n| Feature | Claude Opus 5.5 | Claude Haiku 5.5 |\n| :-- | :-- | :-- |\n| Model page | [Claude Opus 5.5](https://x/opus) | [Claude Haiku 5.5](https://x/haiku) |\n| Claude API ID | \`claude-opus-5-5\` | \`claude-haiku-5-5\` |\n| [Context window](https://x) | 1M tokens | 200K tokens |\n| Max output | 128K tokens | 64K tokens |\n| [Default effort](https://x) | \`medium\` | \`high\` |`;
  const m = parseModels(md);
  assert.strictEqual(m.length, 2);
  assert.deepStrictEqual([m[0].id, m[0].contextWindow, m[0].maxOutput, m[0].defaultEffort, m[0].page], ['claude-opus-5-5', 1000000, 128000, 'medium', 'https://x/opus']);
  assert.strictEqual(m[1].contextWindow, 200000);
});
