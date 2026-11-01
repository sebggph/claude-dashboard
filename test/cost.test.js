// Pricing table parser and cost estimate. Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { parsePricing } from '../src/lib/server/live.js';
import { costOf, priceFor } from '../src/lib/cost.js';

const md = `## Model pricing

| Model | Base input tokens | 5m cache writes | 1h cache writes | Cache hits and refreshes | Output tokens |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Claude Opus 5.5 | $4 / MTok | $5 / MTok | $8 / MTok | $0.20 / MTok<sup>2</sup> | $20 / MTok |
| Claude Haiku 5.5 (for prompts up to 100,000 tokens) | $0.10 / MTok | $0.125 / MTok | $0.20 / MTok | $0.01 / MTok | $0.50 / MTok |
| Claude Haiku 5.5 (for prompts over 100,000 tokens) | $0.50 / MTok | $0.625 / MTok | $1 / MTok | $0.05 / MTok | $2.50 / MTok |
| Claude Opus 4 ([retired](https://x)) | $15 / MTok | $18.75 / MTok | $30 / MTok | $1.50 / MTok | $75 / MTok |
`;

test('parses the pricing table, including size tiers and footnotes', () => {
  const p = parsePricing(md);
  assert.deepStrictEqual(p.map((x) => `${x.id}:${x.tier}`), ['claude-opus-5-5:std', 'claude-haiku-5-5:std', 'claude-haiku-5-5:large', 'claude-opus-4:std']);
  assert.strictEqual(p[0].read, 0.2);
  assert.strictEqual(priceFor('claude-haiku-5-5', true, p).input, 0.5);
  assert.strictEqual(priceFor('claude-opus-5-5[1m]', false, p).output, 20);
});

test('estimates cost and caching savings', () => {
  const p = parsePricing(md);
  const c = costOf([{ model: 'claude-opus-5-5', large: false, input: 1e6, cw5m: 0, cw1h: 1e6, read: 10e6, output: 1e6 }, { model: 'mystery-model', input: 5 }], p);
  // 1M input $4 + 1M 1h writes $8 + 10M reads $2 + 1M output $20 = $34
  assert.strictEqual(Math.round(c.usd * 100) / 100, 34);
  // Without cache: 12M input × $4 + $20 = $68 → saved $34
  assert.strictEqual(Math.round(c.saved * 100) / 100, 34);
  assert.deepStrictEqual(c.unknown, ['mystery-model']);
});
