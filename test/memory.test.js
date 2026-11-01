// Memory file discovery and MCP tracking. Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { memoryFor } from '../src/lib/server/memory.js';
import { parseSession } from '../src/lib/server/parser.js';

test('finds CLAUDE.md files, rules, imports and auto memory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-mem-'));
  const claudeDir = path.join(root, 'home', '.claude');
  const proj = path.join(root, 'code', 'app');
  fs.mkdirSync(path.join(proj, '.claude', 'rules'), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'projects', 'p1', 'memory'), { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), 'personal\n');
  fs.writeFileSync(path.join(root, 'code', 'CLAUDE.md'), 'parent\n');
  fs.writeFileSync(path.join(proj, 'CLAUDE.md'), 'See @extra.md and `@not-this`\n');
  fs.writeFileSync(path.join(proj, 'extra.md'), 'x\n'.repeat(250));
  fs.writeFileSync(path.join(proj, '.claude', 'rules', 'api.md'), '---\npaths:\n  - "src/**"\n---\nrule\n');
  fs.writeFileSync(path.join(claudeDir, 'projects', 'p1', 'memory', 'MEMORY.md'), 'line\n'.repeat(300));

  const m = memoryFor({ cwd: proj, projectDir: 'p1', claudeDir });
  const byName = (n) => m.files.find((f) => f.path.endsWith(n));
  assert.ok(m.projectReadable);
  assert.strictEqual(byName('.claude/CLAUDE.md').scope, 'user');
  assert.strictEqual(byName('code/CLAUDE.md').scope, 'parent folder');
  assert.ok(byName('extra.md').via.endsWith('app/CLAUDE.md'));
  assert.ok(byName('extra.md').tooLong);
  assert.ok(!m.files.some((f) => f.path.endsWith('not-this')));
  assert.strictEqual(byName('api.md').loads, 'on demand');
  assert.strictEqual(byName('MEMORY.md').scope, 'auto memory');
  assert.ok(m.atStart > 0);
});

test('tracks MCP servers, loaded definitions and failed servers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-mcp-'));
  const f = path.join(dir, 's.jsonl');
  const rows = [
    { type: 'attachment', attachment: { type: 'deferred_tools_delta', addedNames: ['Read', 'mcp__gh__list', 'mcp__gh__get'], surfacedDefinitions: [{ name: 'mcp__gh__list', definition: { name: 'mcp__gh__list', description: 'x'.repeat(400) } }], pendingMcpServers: [], needsAuthMcpServers: ['dd'], failedMcpServers: [{ name: 'jira', errorCode: 'ERR' }] } },
    { type: 'attachment', attachment: { type: 'mcp_instructions_delta', addedNames: ['gh'], addedBlocks: ['## gh\nuse me'] } },
    { type: 'user', message: { role: 'user', content: 'hi' } },
    { type: 'assistant', timestamp: '2026-01-01T00:00:00Z', message: { id: 'a', content: [], usage: { input_tokens: 1, cache_creation_input_tokens: 30000, cache_read_input_tokens: 0, output_tokens: 5 } } },
  ];
  fs.writeFileSync(f, rows.map((r) => JSON.stringify(r)).join('\n'));
  const s = parseSession(f);
  assert.strictEqual(s.mcp.servers.length, 1);
  const gh = s.mcp.servers[0];
  assert.deepStrictEqual([gh.name, gh.tools, gh.loadedTools], ['gh', 2, 1]);
  assert.ok(gh.loadedTokens > 0 && gh.instructionsTokens > 0);
  assert.deepStrictEqual(s.mcp.issues.map((i) => i.status), ['needs_auth', 'failed']);
  assert.ok(s.breakdown.fixed.mcp_tools > 0);
});
