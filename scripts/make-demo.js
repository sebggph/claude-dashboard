// Generates sample sessions in ./samples so the dashboard has something to
// show when no real sessions are mounted. Run: node scripts/make-demo.js

'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'samples');
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.floor(rand() * 16);
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});
const lorem = (n) => {
  const w = ['context', 'tokens', 'function', 'const', 'return', 'import', 'test', 'config', 'session', 'value', 'error', 'result', 'async', 'await', 'export', 'module'];
  let s = '';
  while (s.length < n) s += w[Math.floor(rand() * w.length)] + (rand() < 0.1 ? '\n' : ' ');
  return s.slice(0, n);
};

function session({ id, project, branch, model, title, start, steps, fixed, skills = 4000, mcpInstr = 0, compactAt = [], mcpAddedAt = null, mcpTools = 0 }) {
  const rows = [];
  const base = { sessionId: id, cwd: project, gitBranch: branch, version: '2.1.300', entrypoint: 'cli' };
  let t = new Date(start).getTime();
  const ts = () => new Date((t += 20000 + rand() * 60000)).toISOString();
  rows.push({ type: 'ai-title', aiTitle: title, sessionId: id });
  rows.push({ ...base, type: 'attachment', timestamp: ts(), attachment: { type: 'skill_listing', content: lorem(skills * 3.4) } });
  if (mcpInstr) rows.push({ ...base, type: 'attachment', timestamp: ts(), attachment: { type: 'mcp_instructions_delta', addedNames: ['github'], addedBlocks: [lorem(mcpInstr * 3.4)] } });

  let ctx = fixed + skills + mcpInstr;
  let fx = fixed;
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    if (compactAt.includes(i)) {
      rows.push({ ...base, type: 'system', subtype: 'compact_boundary', timestamp: ts(), compactMetadata: { trigger: 'auto', preTokens: ctx } });
      const summary = lorem(9000);
      rows.push({ ...base, type: 'user', isCompactSummary: true, timestamp: ts(), message: { role: 'user', content: summary } });
      ctx = fx + skills + Math.ceil(summary.length / 3.4);
    }
    if (mcpAddedAt === i) fx += mcpTools;
    if (st.prompt) {
      rows.push({ ...base, type: 'user', uuid: uuid(), timestamp: ts(), message: { role: 'user', content: st.prompt } });
      ctx += Math.ceil(st.prompt.length / 3.4);
    }
    if (st.result) {
      const content = lorem(st.result.chars);
      rows.push({ ...base, type: 'user', uuid: uuid(), timestamp: ts(), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: st.result.id, content }] } });
      ctx += Math.ceil(content.length / 2.1);
    }
    const out = st.out || 300;
    const think = Math.round(out * (st.think || 0.3));
    const msgId = 'msg_' + uuid().replace(/-/g, '').slice(0, 20);
    const total = ctx + (mcpAddedAt != null && i >= mcpAddedAt ? mcpTools : 0);
    const prev = i === 0 ? 0 : Math.round(total * (st.cold ? 0 : 0.96));
    const usage = {
      input_tokens: 3,
      cache_creation_input_tokens: total - prev - 3 > 0 ? total - prev - 3 : 0,
      cache_read_input_tokens: prev,
      output_tokens: out,
      output_tokens_details: { thinking_tokens: think },
    };
    const time = ts();
    rows.push({ ...base, type: 'assistant', uuid: uuid(), timestamp: time, message: { id: msgId, role: 'assistant', model, content: [{ type: 'thinking', thinking: '', signature: 'x' }], usage } });
    const content = [];
    if (st.say) content.push({ type: 'text', text: st.say });
    if (st.tool) content.push({ type: 'tool_use', id: st.tool.id, name: st.tool.name, input: st.tool.input });
    rows.push({ ...base, type: 'assistant', uuid: uuid(), timestamp: time, message: { id: msgId, role: 'assistant', model, content, usage } });
    ctx += out;
  }
  const dir = path.join(OUT, project.replace(/[\\/]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + '.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

function steps(n, opts = {}) {
  const tools = [
    () => ({ name: 'Read', input: { file_path: `src/${['app', 'server', 'utils', 'api', 'db'][Math.floor(rand() * 5)]}.ts` } }),
    () => ({ name: 'Bash', input: { command: ['npm test', 'git status', 'npm run build', 'ls -la src'][Math.floor(rand() * 4)] } }),
    () => ({ name: 'Grep', input: { pattern: 'useContext' } }),
    () => ({ name: 'Edit', input: { file_path: 'src/app.ts', old_string: lorem(200), new_string: lorem(260) } }),
    ...(opts.mcp ? [() => ({ name: 'mcp__github__list_issues', input: { repo: 'acme/web' } }), () => ({ name: 'mcp__linear__search', input: { query: 'bug' } })] : []),
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const id = 'toolu_' + uuid().replace(/-/g, '').slice(0, 20);
    const tool = { id, ...tools[Math.floor(rand() * tools.length)]() };
    const big = opts.bigEvery && i % opts.bigEvery === 3;
    out.push({
      prompt: i % 4 === 0 ? ['Add a dark mode toggle to the settings page', 'Why are the tests failing?', 'Refactor the API client to use fetch', 'Write docs for the deploy script', 'Fix the login redirect bug'][Math.floor(rand() * 5)] : null,
      say: 'Let me check that.',
      tool,
      out: 120 + Math.floor(rand() * 900),
      think: 0.2 + rand() * 0.4,
      result: null,
    });
    out.push({ result: { id, chars: big ? 40000 + Math.floor(rand() * 20000) : 800 + Math.floor(rand() * 5000) }, out: 80 + Math.floor(rand() * 300), say: 'Done.', cold: opts.coldAt === i });
  }
  return out;
}

fs.rmSync(OUT, { recursive: true, force: true });
const day = 86400000;
const now = Date.now();
session({
  id: '0a1b2c3d-1111-4aaa-8aaa-000000000001', project: '/Users/demo/projects/web-shop', branch: 'feature/dark-mode', model: 'claude-sonnet-5',
  title: 'Add dark mode to settings page', start: new Date(now - 2 * 3600000).toISOString(), steps: steps(14), fixed: 21000,
});
session({
  id: '0a1b2c3d-2222-4aaa-8aaa-000000000002', project: '/Users/demo/projects/api-server', branch: 'main', model: 'claude-opus-5-5',
  title: 'Investigate failing integration tests', start: new Date(now - 6 * 3600000).toISOString(), steps: steps(40, { mcp: true, bigEvery: 7 }),
  fixed: 26000, mcpInstr: 900, mcpAddedAt: 6, mcpTools: 42000,
});
session({
  id: '0a1b2c3d-3333-4aaa-8aaa-000000000003', project: '/Users/demo/projects/mobile-app', branch: 'refactor/navigation', model: 'claude-sonnet-4-6',
  title: 'Refactor navigation stack', start: new Date(now - 1.5 * day).toISOString(), steps: steps(55, { bigEvery: 9, coldAt: 30 }), fixed: 19000,
  compactAt: [40, 90],
});
session({
  id: '0a1b2c3d-4444-4aaa-8aaa-000000000004', project: '/Users/demo/projects/docs-site', branch: 'main', model: 'claude-haiku-5-5',
  title: 'Write deploy guide', start: new Date(now - 3 * day).toISOString(), steps: steps(6), fixed: 15000, skills: 2500,
});
console.log('Demo sessions written to', OUT);
