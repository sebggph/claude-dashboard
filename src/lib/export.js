// Export a session as CSV, JSON or a Markdown report. Pure functions (no DOM)
// so they can be tested; the caller passes how to mask private text.

/** One CSV cell. Quotes when needed and defuses spreadsheet formulas
 *  (a cell starting with = + - @ could run as a formula in Excel/Sheets). */
export function csvCell(v) {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

const FIXED = ['system_prompt', 'mcp_tools', 'memory_files', 'tools_other', 'tools_and_memory', 'fixed_overhead'];

/** Breakdown: group, part, tokens, share of the context window. */
export function breakdownCSV(s, win) {
  const rows = [['group', 'part', 'tokens', 'share_of_window']];
  const f = (s.breakdown && s.breakdown.fixed) || {};
  const c = (s.breakdown && s.breakdown.categories) || {};
  const share = (t) => (win ? (t / win).toFixed(4) : '');
  for (const k of FIXED) if (f[k]) rows.push(['setup', k, f[k], share(f[k])]);
  for (const [k, v] of Object.entries(c)) if (v) rows.push(['messages', k, v, share(v)]);
  rows.push(['total', 'context_used', s.contextTokens, share(s.contextTokens)]);
  return toCSV(rows);
}

/** Timeline: one row per request. */
export function timelineCSV(s, mask) {
  const rows = [['request', 'time', 'context_tokens', 'change', 'cache_read', 'cache_write', 'output', 'compacted', 'biggest_item', 'biggest_item_tokens']];
  const steps = s.steps || [];
  (s.timeline || []).forEach((r, i) => {
    const st = steps[i] || {};
    const top = st.top && st.top[0];
    rows.push([i + 1, r.time, r.total, st.delta ?? '', r.cacheRead, r.cacheWrite, r.output, st.compacted ? 'yes' : '',
      top ? [top.tool || top.cat, mask.text(top.label)].filter(Boolean).join(' ') : '', top ? top.tokens : '']);
  });
  return toCSV(rows);
}

/** Tools: calls and context per tool. */
export function toolsCSV(s) {
  const rows = [['tool', 'mcp_server', 'calls', 'input_tokens', 'result_tokens', 'errors']];
  for (const x of s.tools || []) rows.push([x.name, x.server || '', x.calls, x.callTokens, x.resultTokens, x.errors]);
  return toCSV(rows);
}

/** Full data as JSON, without local file paths (and masked in privacy mode). */
export function sessionJSON(s, mask) {
  const copy = JSON.parse(JSON.stringify(s));
  delete copy.file;
  if (mask.on) {
    copy.title = mask.title(s);
    copy.firstPrompt = null;
    copy.project = mask.project(s.project);
    copy.gitBranch = copy.gitBranch ? '•••' : copy.gitBranch;
    for (const b of copy.biggest || []) b.label = '';
    for (const st of copy.steps || []) { st.prompt = null; for (const it of st.top || []) it.label = ''; }
    for (const a of copy.subagents || []) a.description = null;
    if (copy.memory) for (const f of copy.memory.files) { f.path = mask.path(f.path); if (f.via) f.via = mask.path(f.via); }
  }
  return JSON.stringify(copy, null, 2) + '\n';
}

/** A short, readable Markdown report. `t` translates, `fmt` formats numbers. */
export function reportMarkdown(s, { t, fmt, mask, health, win, cost }) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lines = [
    `# ${t('rc_text_title')}: ${mask.title(s)}`,
    '',
    `- ${t('col_model')}: ${s.model || '–'} · ${t('rc_text_context')}: ${fmt(s.contextTokens)} ${t('rc_text_of')} ${fmt(win)} (${pct(s.contextTokens / win)})`,
    `- ${t('col_health')}: **${t('health_' + health.grade)}** · ${t('st_requests')}: ${s.requests} · ${t('col_compact')}: ${s.compactions} · ${t('kpi_cache')}: ${pct(s.cacheHitRate)}`,
  ];
  if (cost) lines.push(`- ${t('cost_est')}: ${cost.usd} · ${t('cost_saved')}: ${cost.saved}`);
  lines.push('', `## ${t('rc_fixes')}`, '');
  if (health.recs.length) health.recs.slice(0, 5).forEach((r, i) => lines.push(`${i + 1}. **${r.title}**: ${r.why}`));
  else lines.push(t('rc_none'));
  lines.push('', `## ${t('cmp_setup')}`, '', `| ${t('exp_part')} | Tokens |`, '| --- | ---: |');
  const f = (s.breakdown && s.breakdown.fixed) || {};
  for (const k of FIXED) if (f[k]) lines.push(`| ${t('row_' + k)} | ${fmt(f[k])} |`);
  lines.push('', `## ${t('tools_title')}`, '', `| ${t('col_tool')} | ${t('col_calls')} | Tokens |`, '| --- | ---: | ---: |');
  for (const x of (s.tools || []).slice(0, 10)) lines.push(`| ${x.name} | ${x.calls} | ${fmt(x.callTokens + x.resultTokens)} |`);
  lines.push('', `_${t('rc_text_footer')}_`, '');
  return lines.join('\n');
}
