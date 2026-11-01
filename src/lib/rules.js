// Context rules and formatting helpers shared by the pages.
import { ui, data, t } from './state.svelte.js';
import { fmtK } from './charts.js';

export { fmtK };

// ---------- formatting ----------

export const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export const pctSmart = (x) => (x > 0 && x < 0.01 ? '<1%' : pct(x, x < 0.1 ? 1 : 0));

export function ago(iso) {
  if (!iso) return '–';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return t('ago_now');
  if (s < 3600) return t('ago_min', { n: Math.round(s / 60) });
  if (s < 86400) return t('ago_h', { n: Math.round(s / 3600) });
  return t('ago_d', { n: Math.round(s / 86400) });
}

export function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00Z').toLocaleDateString(ui.lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch { return d; }
}

// claude-opus-5-5 → Opus 5.5, claude-sonnet-4-6[1m] → Sonnet 4.6 [1m]
export function shortModel(m) {
  if (!m) return '–';
  const v = m.replace(/^claude-/, '').replace(/-\d{8}$/, '').match(/^([a-z]+)-(\d+)(?:-(\d{1,2}))?(.*)$/i);
  if (!v) return m.replace(/^claude-/, '');
  return `${v[1][0].toUpperCase()}${v[1].slice(1)} ${v[2]}${v[3] ? '.' + v[3] : ''}${v[4] ? ' ' + v[4].replace(/^-/, '') : ''}`;
}

export function projectName(p) {
  if (!p) return '–';
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join('/') || p;
}

export function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

export const winLabel = (w) => (w >= 1e6 ? '1M' : fmtK(w));
export const slugOf = (file) => file.replace(/\.md$/, '');

// ---------- context window rules (official model-config docs) ----------
// 1M by default: Fable, Sonnet 5+, Haiku 5.5+, Opus 4.7+, or any "[1m]" model.
// Those compact at ~967K, leaving a ~33K reserve. 200K models compact at the limit.
export function nativeWindow(model) {
  if (!model) return 200000;
  const m = model.toLowerCase();
  if (m.includes('[1m]') || m.includes('fable')) return 1000000;
  const v = m.match(/(opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?!\d)/);
  if (!v) return 200000;
  const ver = Number(v[2]) + (v[3] ? Number(v[3]) / 10 : 0);
  if (v[1] === 'sonnet' && ver >= 5) return 1000000;
  if (v[1] === 'haiku' && ver >= 5.5) return 1000000;
  if (v[1] === 'opus' && ver >= 4.7) return 1000000;
  return 200000;
}

// The live model table from the official docs (when available) wins over the rules.
export function liveModel(model) {
  const list = data.live && data.live.models && data.live.models.list;
  if (!model || !list) return null;
  const id = model.toLowerCase().replace(/\[1m\]$/, '').replace(/-\d{8}$/, '');
  return list.find((m) => m.id === id) || null;
}

export function windowFor(s) {
  if (ui.window !== 'auto') return Number(ui.window);
  const lm = liveModel(s.model);
  const w = s.model && s.model.includes('[1m]') ? 1000000 : (lm && lm.contextWindow) || nativeWindow(s.model);
  return s.peakTokens > w ? 1000000 : w;
}
export const bufferFor = (win) => (win >= 1000000 ? 33000 : 0);

// ---------- breakdown ----------
// Six colored groups (fixed categorical order), each with detail rows.
export const GROUPS = [
  { id: 'fixed', color: 'var(--s1)', rows: ['system_prompt', 'tools_and_memory', 'fixed_overhead'] },
  { id: 'listings', color: 'var(--s2)', rows: ['skills', 'mcp_instructions', 'deferred_tools', 'agents', 'reminders', 'hooks', 'compact_summary'] },
  { id: 'user', color: 'var(--s3)', rows: ['user'] },
  { id: 'assistant', color: 'var(--s4)', rows: ['assistant', 'thinking'] },
  { id: 'calls', color: 'var(--s5)', rows: ['tool_calls'] },
  { id: 'results', color: 'var(--s6)', rows: ['tool_results'] },
];
export const CAT_COLOR = {};
for (const g of GROUPS) for (const r of g.rows) CAT_COLOR[r] = g.color;

// Which explanation (context-guide.json) belongs to each row.
export const GUIDE_KEY = {
  system_prompt: 'system_prompt', tools_and_memory: 'system_tools', fixed_overhead: 'system_tools',
  skills: 'skills', mcp_instructions: 'mcp_instructions', deferred_tools: 'deferred_tools', agents: 'messages',
  reminders: 'messages', hooks: 'messages', compact_summary: 'compaction', user: 'user_messages',
  assistant: 'assistant_text', thinking: 'thinking', tool_calls: 'tool_calls', tool_results: 'tool_results',
  buffer: 'autocompact_buffer', free: 'free_space', cache: 'cache',
};

export function breakdownOf(s) {
  const b = s.breakdown || { fixed: {}, categories: {} };
  const values = { ...b.fixed, ...b.categories };
  const win = windowFor(s);
  const buffer = bufferFor(win);
  const used = s.contextTokens;
  const groups = GROUPS.map((g) => {
    const rows = g.rows.filter((r) => values[r] > 0).map((r) => ({ id: r, tokens: values[r] }));
    return { ...g, rows, tokens: rows.reduce((a, r) => a + r.tokens, 0) };
  }).filter((g) => g.tokens > 0);
  return { win, buffer, used, free: Math.max(0, win - used - buffer), groups };
}

// ---------- in-app guide links ----------
export const REC_GUIDE = {
  high_usage: 'compaction', frequent_compaction: 'compaction', long_session_many_turns: '02-keep-context-lean',
  large_tool_results: '02-keep-context-lean', many_file_reads: '02-keep-context-lean',
  model_switch_midsession: 'change-or-restart', idle_cache_expired: 'change-or-restart', low_cache_hit: 'change-or-restart',
  heavy_thinking: 'change-or-restart', big_fixed_overhead: 'optimize-existing-project', many_mcp_tools: 'optimize-existing-project',
  many_skills: 'optimize-existing-project', big_memory_file: '03-claude-md-memory',
};
export const CAT_GUIDE = {
  compaction: 'compaction', autocompact_buffer: 'compaction', free_space: 'compaction', cache: 'change-or-restart',
  system_prompt: 'optimize-existing-project', system_tools: 'optimize-existing-project', mcp_tools: 'optimize-existing-project',
  mcp_instructions: 'optimize-existing-project', skills: 'optimize-existing-project', deferred_tools: '04-mcp-skills-subagents',
  memory_files: '03-claude-md-memory', tool_results: '02-keep-context-lean', tool_calls: '02-keep-context-lean',
  thinking: 'change-or-restart', messages: '01-what-is-context', user_messages: '02-keep-context-lean', assistant_text: '01-what-is-context',
};
export const guideMeta = (slug) => (data.docsIndex[ui.lang] || []).find((g) => slugOf(g.file) === slug);

// Sections of the Learn page, in order.
export const SECTIONS = ['start', 'concepts', 'habits', 'security'];

// ---------- recommendations ----------
export const LEVEL = {
  serious: { color: 'var(--serious)', icon: 'alert' },
  warning: { color: 'var(--warning)', icon: 'alert' },
  info: { color: 'var(--s1)', icon: 'bulb' },
};

export function recommendationsFor(s, memoryFiles = []) {
  const guide = data.guide;
  if (!guide) return [];
  const { win, used } = breakdownOf(s);
  const cats = (s.breakdown && s.breakdown.categories) || {};
  const msgs = Object.values(cats).reduce((a, v) => a + v, 0) || 1;
  const sig = s.signals || {};
  const fixed = s.breakdown ? s.breakdown.fixedTotal || 0 : 0;
  const hits = [];
  const add = (id, level, why) => hits.push({ id, level, why });

  if (used / win > 0.7) add('high_usage', 'serious', t('why_high_usage', { p: pct(used / win) }));
  if (sig.largestToolResult > 10000 || (cats.tool_results || 0) / msgs > 0.5) add('large_tool_results', 'warning', t('why_large_tool_results', { t: fmtK(sig.largestToolResult) }));
  if (s.breakdown && s.breakdown.fixedAtStart != null && fixed - s.breakdown.fixedAtStart > win * 0.05) add('many_mcp_tools', 'warning', t('why_many_mcp_tools', { t: fmtK(fixed - s.breakdown.fixedAtStart) }));
  if (fixed > Math.max(40000, win * 0.2)) add('big_fixed_overhead', 'info', t('why_big_fixed_overhead', { t: fmtK(fixed) }));
  if (s.compactions >= 2) add('frequent_compaction', 'warning', t('why_frequent_compaction', { n: s.compactions }));
  if (s.userPrompts > 80) add('long_session_many_turns', 'info', t('why_long_session_many_turns', { n: s.userPrompts }));
  if (s.requests >= 5 && s.cacheHitRate < 0.7) add('low_cache_hit', 'info', t('why_low_cache_hit', { p: pct(s.cacheHitRate) }));
  for (const f of memoryFiles) if (f.tokens > 10000 || f.lines > 200) { add('big_memory_file', 'info', t('why_big_memory_file', { f: f.path, t: fmtK(f.tokens) })); break; }
  if ((cats.thinking || 0) / msgs > 0.5 && s.totals.thinking > 0) add('heavy_thinking', 'info', t('why_heavy_thinking', { p: pct((cats.thinking || 0) / msgs) }));
  if (sig.fileReads > 30 || sig.mostReadFile) add('many_file_reads', 'info', t('why_many_file_reads', { n: sig.fileReads }));
  if (sig.models && sig.models.length > 1) add('model_switch_midsession', 'info', t('why_model_switch', { m: sig.models.map(shortModel).join(' → ') }));
  if (sig.idleRebuilds > 0) add('idle_cache_expired', 'info', t('why_idle_cache_expired', { n: sig.idleRebuilds }));
  if ((cats.skills || 0) > win * 0.01) add('many_skills', 'info', t('why_many_skills', { t: fmtK(cats.skills) }));

  const latest = data.live && data.live.version && data.live.version.latest;
  if (latest && s.version && cmpVersion(s.version, latest) < 0 && s.end && Date.now() - new Date(s.end) < 7 * 86400000) {
    add('outdated_version', 'info', t('why_outdated_version', { v: s.version, l: latest }));
  }

  const order = { serious: 0, warning: 1, info: 2 };
  return hits
    .map((h) => ({ ...h, def: guide.recommendations.find((r) => r.id === h.id) }))
    .filter((h) => h.def)
    .sort((a, b) => order[a.level] - order[b.level]);
}

export const sourceName = (id) => ({ 'claude-code': 'Claude Code', platform: 'Claude Platform' }[id] || id);
