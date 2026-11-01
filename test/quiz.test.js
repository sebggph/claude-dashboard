// Cheatsheet quiz. Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { makeQuiz } from '../src/lib/quiz.js';

const cs = JSON.parse(fs.readFileSync(new URL('../static/data/cheatsheet.json', import.meta.url)));

test('10 questions, 4 unique choices, correct answer included', () => {
  const q = makeQuiz(cs.sections, { seed: 42 });
  assert.strictEqual(q.length, 10);
  for (const x of q) {
    assert.strictEqual(new Set(x.choices).size, 4);
    assert.strictEqual(x.choices[x.answer], x.item.cmd);
  }
  assert.strictEqual(new Set(q.map((x) => x.item.cmd)).size, 10); // no repeats
});

test('same seed, same round; section filter works', () => {
  assert.deepStrictEqual(makeQuiz(cs.sections, { seed: 7 }).map((x) => x.item.cmd), makeQuiz(cs.sections, { seed: 7 }).map((x) => x.item.cmd));
  const keys = makeQuiz(cs.sections, { section: 'keys', seed: 3 });
  assert.ok(keys.length > 0 && keys.every((x) => x.sectionId === 'keys'));
});
