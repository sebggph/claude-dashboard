// Compare two sessions. Setup cost (what loads before you type) is fair to
// compare; the conversation part mostly depends on the work that was done.

const SETUP_PARTS = ['system_prompt', 'mcp_tools', 'memory_files', 'builtin', 'skills', 'listings'];
const CONVO_PARTS = ['user', 'assistant', 'thinking', 'tool_calls', 'tool_results', 'other'];

export function setupOf(s) {
  const f = (s.breakdown && s.breakdown.fixed) || {};
  const c = (s.breakdown && s.breakdown.categories) || {};
  const parts = {
    system_prompt: f.system_prompt || 0,
    mcp_tools: f.mcp_tools || 0,
    memory_files: f.memory_files || 0,
    builtin: (f.tools_other || 0) + (f.tools_and_memory || 0) + (f.fixed_overhead || 0),
    skills: c.skills || 0,
    listings: (c.mcp_instructions || 0) + (c.deferred_tools || 0) + (c.agents || 0),
  };
  return { parts, total: SETUP_PARTS.reduce((a, k) => a + parts[k], 0) };
}

export function conversationOf(s) {
  const c = (s.breakdown && s.breakdown.categories) || {};
  const parts = {
    user: c.user || 0,
    assistant: c.assistant || 0,
    thinking: c.thinking || 0,
    tool_calls: c.tool_calls || 0,
    tool_results: c.tool_results || 0,
    other: (c.reminders || 0) + (c.hooks || 0) + (c.compact_summary || 0),
  };
  return { parts, total: CONVO_PARTS.reduce((a, k) => a + parts[k], 0) };
}

export { SETUP_PARTS, CONVO_PARTS };

/**
 * Difference from A to B. better: 'lower' | 'higher' | null (neutral).
 * verdict is 'better' | 'worse' | 'same' (changes under 3% count as the same).
 */
export function delta(a, b, better = 'lower') {
  if (a == null || b == null) return { diff: null, rel: null, verdict: 'same' };
  const diff = b - a;
  const rel = a ? diff / a : b ? 1 : 0;
  if (!better || Math.abs(rel) < 0.03) return { diff, rel, verdict: 'same' };
  const improved = better === 'lower' ? diff < 0 : diff > 0;
  return { diff, rel, verdict: improved ? 'better' : 'worse' };
}

/** The biggest setup changes from A to B, largest first. */
export function setupChanges(a, b, min = 500) {
  const sa = setupOf(a).parts, sb = setupOf(b).parts;
  return SETUP_PARTS
    .map((k) => ({ key: k, a: sa[k], b: sb[k], ...delta(sa[k], sb[k]) }))
    .filter((x) => Math.abs(x.diff) >= min)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}

/** Union of tools used in both sessions with calls and context tokens. */
export function toolsCompared(a, b, limit = 10) {
  const m = new Map();
  for (const [side, s] of [['a', a], ['b', b]]) {
    for (const x of s.tools || []) {
      const row = m.get(x.name) || { name: x.name, server: x.server, a: { calls: 0, tokens: 0 }, b: { calls: 0, tokens: 0 } };
      row[side] = { calls: x.calls, tokens: x.callTokens + x.resultTokens };
      m.set(x.name, row);
    }
  }
  return [...m.values()].sort((x, y) => Math.max(y.a.tokens, y.b.tokens) - Math.max(x.a.tokens, x.b.tokens)).slice(0, limit);
}
