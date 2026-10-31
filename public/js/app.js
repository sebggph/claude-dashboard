// Claude Context Dashboard: front end (vanilla JS, no build step).
import { STRINGS } from './i18n.js';
import { icon } from './icons.js';
import { growthChart, fmtK } from './charts.js';
import { renderMarkdown } from './markdown.js';

// ---------- state & helpers ----------

const store = {
  get(k, d) { try { const v = localStorage.getItem('ccd.' + k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ccd.' + k, v); } catch { /* private mode */ } },
};

const state = {
  lang: store.get('lang', (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'),
  theme: store.get('theme', 'auto'),
  window: store.get('window', 'auto'), // 'auto' | '200000' | '1000000'
  sessions: null,
  guide: null,
  cheatsheet: null,
  docsIndex: {},
  sort: { key: 'end', dir: -1 },
  query: '',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function t(key, vars = {}) {
  const s = (STRINGS[state.lang] && STRINGS[state.lang][key]) ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
const L = (obj) => (obj ? obj[state.lang] ?? obj.en ?? '' : '');
const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;
const pctSmart = (x) => (x > 0 && x < 0.01 ? '<1%' : pct(x, x < 0.1 ? 1 : 0));

function ago(iso) {
  if (!iso) return '–';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return t('ago_now');
  if (s < 3600) return t('ago_min', { n: Math.round(s / 60) });
  if (s < 86400) return t('ago_h', { n: Math.round(s / 3600) });
  return t('ago_d', { n: Math.round(s / 86400) });
}

function shortModel(m) {
  if (!m) return '–';
  // claude-opus-5-5 → Opus 5.5, claude-sonnet-4-6[1m] → Sonnet 4.6 [1m]
  const v = m.replace(/^claude-/, '').replace(/-\d{8}$/, '').match(/^([a-z]+)-(\d+)(?:-(\d{1,2}))?(.*)$/i);
  if (!v) return m.replace(/^claude-/, '');
  return `${v[1][0].toUpperCase()}${v[1].slice(1)} ${v[2]}${v[3] ? '.' + v[3] : ''}${v[4] ? ' ' + v[4].replace(/^-/, '') : ''}`;
}

function projectName(p) {
  if (!p) return '–';
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join('/') || p;
}

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// ---------- context window rules (from the official model-config docs) ----------
// 1M by default: Fable, Sonnet 5+, Haiku 5.5+, Opus 4.7+, or any "[1m]" model.
// Those compact at ~967K, leaving a ~33K reserve. 200K models compact at the limit.
function nativeWindow(model) {
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
function windowFor(s) {
  if (state.window !== 'auto') return Number(state.window);
  const w = nativeWindow(s.model);
  return s.peakTokens > w ? 1000000 : w;
}
const bufferFor = (win) => (win >= 1000000 ? 33000 : 0);

// ---------- context breakdown model ----------
// Six colored groups (fixed categorical order), each with detail rows.
const GROUPS = [
  { id: 'fixed', color: 'var(--s1)', rows: ['system_prompt', 'tools_and_memory', 'fixed_overhead'] },
  { id: 'listings', color: 'var(--s2)', rows: ['skills', 'mcp_instructions', 'deferred_tools', 'agents', 'reminders', 'hooks', 'compact_summary'] },
  { id: 'user', color: 'var(--s3)', rows: ['user'] },
  { id: 'assistant', color: 'var(--s4)', rows: ['assistant', 'thinking'] },
  { id: 'calls', color: 'var(--s5)', rows: ['tool_calls'] },
  { id: 'results', color: 'var(--s6)', rows: ['tool_results'] },
];
const CAT_COLOR = {};
for (const g of GROUPS) for (const r of g.rows) CAT_COLOR[r] = g.color;

// Which explanation (context-guide.json) belongs to each row.
const GUIDE_KEY = {
  system_prompt: 'system_prompt', tools_and_memory: 'system_tools', fixed_overhead: 'system_tools',
  skills: 'skills', mcp_instructions: 'mcp_instructions', deferred_tools: 'deferred_tools', agents: 'messages',
  reminders: 'messages', hooks: 'messages', compact_summary: 'compaction', user: 'user_messages',
  assistant: 'assistant_text', thinking: 'thinking', tool_calls: 'tool_calls', tool_results: 'tool_results',
  buffer: 'autocompact_buffer', free: 'free_space', cache: 'cache',
};

function breakdownOf(s) {
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

// ---------- recommendations ----------
function recommendationsFor(s, memoryFiles = []) {
  const guide = state.guide;
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

  const order = { serious: 0, warning: 1, info: 2 };
  return hits
    .map((h) => ({ ...h, def: guide.recommendations.find((r) => r.id === h.id) }))
    .filter((h) => h.def)
    .sort((a, b) => order[a.level] - order[b.level]);
}

const LEVEL = {
  serious: { color: 'var(--serious)', icon: 'alert' },
  warning: { color: 'var(--warning)', icon: 'alert' },
  info: { color: 'var(--s1)', icon: 'bulb' },
};

function recCard(r, session) {
  const lv = LEVEL[r.level];
  return `<div class="rec">
    <div class="rec-icon" style="color:${lv.color}">${icon(lv.icon)}</div>
    <div>
      <h3>${esc(L(r.def.title))}${session ? ` <span class="muted small">· ${esc(session)}</span>` : ''}</h3>
      <p>${esc(L(r.def.text))}</p>
      <div class="why">${esc(t('why_triggered', { x: r.why }))}</div>
      ${r.def.doc ? `<a href="${esc(r.def.doc)}" target="_blank" rel="noopener noreferrer">${t('learn_more')} ↗</a>` : ''}
    </div>
  </div>`;
}

// ---------- shell: nav, language, theme, settings ----------

const ROUTES = [
  { id: 'overview', hash: '#/', icon: 'overview' },
  { id: 'sessions', hash: '#/sessions', icon: 'sessions' },
  { id: 'guides', hash: '#/guides', icon: 'book' },
  { id: 'cheatsheet', hash: '#/cheatsheet', icon: 'sheet' },
];

function renderShell(active) {
  document.documentElement.lang = state.lang;
  document.getElementById('nav').innerHTML = ROUTES.map((r) =>
    `<a href="${r.hash}" ${r.id === active ? 'aria-current="page"' : ''}>${icon(r.icon)}<span>${t('nav_' + r.id)}</span></a>`).join('');
  document.getElementById('lang').innerHTML = ['en', 'es'].map((l) =>
    `<button type="button" data-lang="${l}" aria-pressed="${state.lang === l}">${l.toUpperCase()}</button>`).join('');
  const themeBtn = document.getElementById('theme-btn');
  const ti = { auto: 'auto', light: 'sun', dark: 'moon' }[state.theme];
  themeBtn.innerHTML = icon(ti);
  themeBtn.title = `${t('theme')}: ${t('theme_' + state.theme)}`;
  themeBtn.setAttribute('aria-label', themeBtn.title);
  const sb = document.getElementById('settings-btn');
  sb.innerHTML = icon('gear');
  sb.title = t('settings');
  sb.setAttribute('aria-label', t('settings'));
  document.getElementById('settings').innerHTML = `
    <label>${t('set_window')}
      <select id="set-window">
        <option value="auto" ${state.window === 'auto' ? 'selected' : ''}>${t('set_window_auto')}</option>
        <option value="200000" ${state.window === '200000' ? 'selected' : ''}>200K</option>
        <option value="1000000" ${state.window === '1000000' ? 'selected' : ''}>1M</option>
      </select>
    </label>
    <div class="small muted">${t('set_buffer')}: 33K (1M) · 0 (200K). ${t('set_buffer_hint')}</div>`;
  document.getElementById('footer').textContent = t('footer');
}

function applyTheme() {
  if (state.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = state.theme;
}

document.addEventListener('click', (e) => {
  const lb = e.target.closest('[data-lang]');
  if (lb) { state.lang = lb.dataset.lang; store.set('lang', state.lang); route(); return; }
  if (e.target.closest('#theme-btn')) {
    state.theme = { auto: 'light', light: 'dark', dark: 'auto' }[state.theme];
    store.set('theme', state.theme); applyTheme(); renderShell(currentRoute); return;
  }
  const pop = document.getElementById('settings');
  if (e.target.closest('#settings-btn')) {
    pop.hidden = !pop.hidden;
    document.getElementById('settings-btn').setAttribute('aria-expanded', String(!pop.hidden));
    return;
  }
  if (!pop.hidden && !e.target.closest('#settings')) pop.hidden = true;
  if (e.target.closest('#drawer-backdrop') || e.target.closest('.drawer-close')) closeDrawer();
  const ex = e.target.closest('[data-explain]');
  if (ex) openDrawer(ex.dataset.explain, ex.dataset.label);
  const row = e.target.closest('[data-href]');
  if (row && !e.target.closest('a,button')) location.hash = row.dataset.href;
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'set-window') { state.window = e.target.value; store.set('window', state.window); route(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeDrawer(); document.getElementById('settings').hidden = true; }
  const row = e.target.closest && e.target.closest('[data-href]');
  if (row && e.key === 'Enter') location.hash = row.dataset.href;
});

// ---------- explanation drawer ----------

function openDrawer(key, label) {
  const c = state.guide && state.guide.categories[key];
  if (!c) return;
  const d = document.getElementById('drawer');
  d.innerHTML = `
    <button class="icon-btn drawer-close" type="button" aria-label="Close">${icon('close')}</button>
    <h2>${esc(label || L(c.label))}</h2>
    <h3>${t('what_is')}</h3>
    <p>${esc(L(c.what))}</p>
    ${c.tips && c.tips.length ? `<h3>${t('how_reduce')}</h3><ul>${c.tips.map((tip) => `<li>${esc(L(tip))}</li>`).join('')}</ul>` : ''}
    ${c.docs && c.docs.length ? `<h3>${t('official_docs')}</h3><ul>${c.docs.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)} ↗</a></li>`).join('')}</ul>` : ''}`;
  document.body.classList.add('drawer-open');
  d.setAttribute('aria-hidden', 'false');
  d.querySelector('.drawer-close').focus();
}
function closeDrawer() {
  document.body.classList.remove('drawer-open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'true');
}

// ---------- shared pieces ----------

function stackbar(bd, height) {
  const segs = bd.groups.map((g) => `<span style="width:${(g.tokens / bd.win) * 100}%;background:${g.color}" title="${esc(t('grp_' + g.id))}: ${fmtK(g.tokens)}"></span>`).join('');
  const buf = bd.buffer ? `<span class="buffer" style="width:${(bd.buffer / bd.win) * 100}%;margin-left:auto" title="${esc(t('row_buffer'))}"></span>` : '';
  return `<div class="stackbar" ${height ? `style="height:${height}px"` : ''}>${segs}${buf}</div>`;
}

function minibar(s) {
  const bd = breakdownOf(s);
  const p = bd.used / bd.win;
  const segs = bd.groups.map((g) => `<span style="width:${(g.tokens / bd.win) * 100}%;background:${g.color}"></span>`).join('');
  return `<div class="minibar"><div class="track">${segs}</div><span class="pct">${pctSmart(p)}</span></div>`;
}

function loadingView() { return `<div class="empty">${t('loading')}</div>`; }
function errorView(err) {
  return `<div class="card empty"><p><b>${t('error')}</b></p><p class="small muted">${esc(err.message)}</p><button class="btn" onclick="location.reload()">${t('retry')}</button></div>`;
}

function banner() {
  return state.sessions && state.sessions.demo
    ? `<div class="banner">${icon('info')}<span>${t({ unreadable: 'demo_unreadable', missing: 'demo_missing' }[state.sessions.demoReason] || 'demo_banner')}</span></div>` : '';
}

// ---------- pages ----------

function overviewPage() {
  const { sessions, memoryFiles } = state.sessions;
  const now = Date.now();
  const active = sessions.filter((s) => s.end && now - new Date(s.end) < 86400000).length;
  const avgUsed = sessions.length ? sessions.reduce((a, s) => a + s.contextTokens / windowFor(s), 0) / sessions.length : 0;
  const tot = sessions.reduce((a, s) => {
    a.in += s.totals.input + s.totals.cacheWrite + s.totals.cacheRead; a.read += s.totals.cacheRead; a.out += s.totals.output; return a;
  }, { in: 0, read: 0, out: 0 });

  const fullest = [...sessions].sort((a, b) => b.contextTokens / windowFor(b) - a.contextTokens / windowFor(a)).slice(0, 7);

  // Combined mix of what fills context.
  const mix = {};
  for (const s of sessions) for (const g of breakdownOf(s).groups) mix[g.id] = (mix[g.id] || 0) + g.tokens;
  const mixTotal = Object.values(mix).reduce((a, v) => a + v, 0) || 1;
  const mixGroups = GROUPS.filter((g) => mix[g.id]);

  const recs = [];
  for (const s of sessions.slice(0, 30)) for (const r of recommendationsFor(s, memoryFiles)) recs.push({ ...r, session: s.title || s.id.slice(0, 8), sid: s.id });
  const seen = new Set();
  const topRecs = recs.sort((a, b) => ({ serious: 0, warning: 1, info: 2 }[a.level] - { serious: 0, warning: 1, info: 2 }[b.level]))
    .filter((r) => (seen.has(r.id) ? false : seen.add(r.id))).slice(0, 4);

  const guides = (state.docsIndex[state.lang] || []).slice(0, 4);

  return `${banner()}
  <div class="page-head"><div><h1>${t('ov_title')}</h1><p>${t('ov_sub')}</p></div></div>
  <div class="stack">
    <div class="grid grid-4">
      ${kpi(t('kpi_sessions'), sessions.length, t('kpi_sessions_note', { n: active }))}
      ${kpi(t('kpi_avg'), pct(avgUsed), t('kpi_avg_note'))}
      ${kpi(t('kpi_cache'), pct(tot.in ? tot.read / tot.in : 0), t('kpi_cache_note'))}
      ${kpi(t('kpi_tokens'), fmtK(tot.in + tot.out), t('kpi_tokens_note'))}
    </div>
    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h2>${t('ov_fullest')}</h2><a class="small" href="#/sessions">${t('see_all')} →</a></div>
        <div class="hbars">
          ${fullest.map((s) => {
            const bd = breakdownOf(s);
            return `<div class="hbar" data-href="#/session/${esc(s.id)}" tabindex="0" role="link">
              <span class="name" title="${esc(s.title)}">${esc(s.title || s.id)}</span>
              <span class="bar">${bd.groups.map((g) => `<span style="width:${(g.tokens / bd.win) * 100}%;background:${g.color}"></span>`).join('')}</span>
              <span class="val">${pctSmart(bd.used / bd.win)}</span>
            </div>`;
          }).join('') || `<div class="empty">–</div>`}
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>${t('ov_mix')}</h2><span class="card-sub">${t('ov_mix_sub')}</span></div>
        <div class="stackbar" style="height:16px">${mixGroups.map((g) => `<span style="width:${(mix[g.id] / mixTotal) * 100}%;background:${g.color}"></span>`).join('')}</div>
        <div class="legend-rows">
          ${mixGroups.map((g) => `<div class="lrow"><span class="sw" style="background:${g.color}"></span>
            <button class="lbl" type="button" data-explain="${GUIDE_KEY[g.rows[0]]}" data-label="${esc(t('grp_' + g.id))}">${t('grp_' + g.id)}</button>
            <span class="v">${fmtK(mix[g.id])}</span><span class="p">${pctSmart(mix[g.id] / mixTotal)}</span></div>`).join('')}
        </div>
      </section>
    </div>
    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h2>${t('ov_recs')}</h2><span class="card-sub">${t('ov_recs_sub')}</span></div>
        <div class="recs">${topRecs.map((r) => recCard(r, r.session)).join('') || `<div class="empty">${icon('check')} ${t('recs_none')}</div>`}</div>
      </section>
      <section class="card">
        <div class="card-head"><h2>${t('ov_learn')}</h2><a class="small" href="#/guides">${t('see_all')} →</a></div>
        <div class="grid grid-2">${guides.map((g, i) => guideCard(g, i)).join('')}</div>
      </section>
    </div>
  </div>`;
}

function kpi(label, value, note) {
  return `<div class="card kpi"><span class="kpi-label">${esc(label)}</span><span class="kpi-value">${esc(value)}</span><span class="kpi-note">${esc(note)}</span></div>`;
}

function sessionsPage() {
  const q = state.query.toLowerCase();
  const list = state.sessions.sessions.filter((s) => !q || [s.title, s.project, s.model, s.gitBranch].some((v) => v && v.toLowerCase().includes(q)));
  const k = state.sort.key;
  const val = (s) => (k === 'context' ? s.contextTokens / windowFor(s) : k === 'tokens' ? s.totals.output + s.totals.input + s.totals.cacheRead + s.totals.cacheWrite : s[k]);
  list.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * state.sort.dir; });
  const th = (key, label, cls = '') => `<th class="${cls}"><button type="button" data-sort="${key}">${label}${state.sort.key === key ? (state.sort.dir < 0 ? ' ↓' : ' ↑') : ''}</button></th>`;

  return `${banner()}
  <div class="page-head">
    <div><h1>${t('ss_title')}</h1><p>${t('ss_sub')}</p></div>
    <input class="input" id="session-search" type="search" placeholder="${esc(t('search_sessions'))}" value="${esc(state.query)}" aria-label="${esc(t('search_sessions'))}">
  </div>
  <section class="card">
    <div class="table-wrap"><table>
      <thead><tr>${th('title', t('col_session'))}${th('model', t('col_model'))}${th('context', t('col_context'))}${th('userPrompts', t('col_prompts'), 'r')}${th('compactions', t('col_compact'), 'r')}${th('end', t('col_last'), 'r')}</tr></thead>
      <tbody>${list.map((s) => `<tr class="link" data-href="#/session/${esc(s.id)}" tabindex="0">
        <td><div class="cell-title" title="${esc(s.title)}">${esc(s.title || s.id)}</div><div class="cell-sub">${esc(projectName(s.project))}${s.gitBranch ? ' · ' + esc(s.gitBranch) : ''}</div></td>
        <td><span class="badge">${esc(shortModel(s.model))}</span></td>
        <td>${minibar(s)}</td>
        <td class="r num">${s.userPrompts}</td>
        <td class="r num">${s.compactions}</td>
        <td class="r small muted">${ago(s.end)}</td>
      </tr>`).join('') || `<tr><td colspan="6" class="empty">${t('no_sessions')}</td></tr>`}</tbody>
    </table></div>
  </section>`;
}

function contextCard(s) {
  const bd = breakdownOf(s);
  const rowsHtml = bd.groups.map((g) => {
    const single = g.rows.length === 1;
    const head = `<div class="lrow ${single ? '' : 'group'}"><span class="sw" style="background:${g.color}"></span>
      ${single
        ? `<button class="lbl" type="button" data-explain="${GUIDE_KEY[g.rows[0].id]}" data-label="${esc(t('row_' + g.rows[0].id))}">${t('row_' + g.rows[0].id)}</button>`
        : `<span>${t('grp_' + g.id)}</span>`}
      <span class="v">${fmtK(g.tokens)}</span><span class="p">${pctSmart(g.tokens / bd.win)}</span></div>`;
    const subs = single ? '' : g.rows.map((r) => `<div class="lrow sub"><span></span>
      <button class="lbl" type="button" data-explain="${GUIDE_KEY[r.id]}" data-label="${esc(t('row_' + r.id))}">${t('row_' + r.id)}</button>
      <span class="v">${fmtK(r.tokens)}</span><span class="p">${pctSmart(r.tokens / bd.win)}</span></div>`).join('');
    return head + subs;
  }).join('');
  const winLabel = bd.win >= 1e6 ? '1M' : fmtK(bd.win);
  return `<section class="card">
    <div class="card-head"><h2>${t('ctx_title')}</h2><span class="card-sub">${esc(shortModel(s.model))} · ${winLabel}${state.window === 'auto' ? ` (${t('window_auto')})` : ''}</span></div>
    <div class="ctx-top"><span class="ctx-pct">${t('ctx_used', { p: pctSmart(bd.used / bd.win) })}</span><span class="ctx-of">${fmtK(bd.used)} / ${winLabel}</span></div>
    ${stackbar(bd)}
    <div class="legend-rows">
      ${rowsHtml}
      ${bd.buffer ? `<div class="lrow group"><span class="sw buffer"></span><button class="lbl" type="button" data-explain="autocompact_buffer" data-label="${esc(t('row_buffer'))}">${t('row_buffer')}</button><span class="v">${fmtK(bd.buffer)}</span><span class="p">${pctSmart(bd.buffer / bd.win)}</span></div>` : ''}
      <div class="lrow"><span class="sw hollow"></span><button class="lbl" type="button" data-explain="free_space" data-label="${esc(t('row_free'))}">${t('row_free')}</button><span class="v">${fmtK(bd.free)}</span><span class="p">${pctSmart(bd.free / bd.win)}</span></div>
    </div>
    <p class="note">${icon('info')}<span>${t('ctx_note')}</span></p>
  </section>`;
}

function sessionPage(s) {
  const bd = breakdownOf(s);
  const limit = bd.win - bd.buffer;
  const recs = recommendationsFor(s, state.sessions.memoryFiles);
  const tok = s.totals;
  const chips = [projectName(s.project), s.gitBranch, shortModel(s.model), s.version && 'v' + s.version, ago(s.end)].filter(Boolean);
  return `${banner()}
  <a href="#/sessions" class="small">${icon('back', 'icon')} ${t('back')}</a>
  <div class="page-head" style="margin-top:10px">
    <div><h1>${esc(s.title || s.id)}</h1><div class="chips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div></div>
  </div>
  <div class="stack">
    <div class="grid grid-2">
      ${contextCard(s)}
      <div class="col-fill">
        <section class="card">
          <div class="card-head"><h2>${t('growth_title')}</h2><span class="card-sub">${t('growth_sub')}</span></div>
          <div id="growth"></div>
        </section>
        <div class="grid grid-2">
          ${kpi(t('st_peak'), fmtK(s.peakTokens), pct(s.peakTokens / bd.win) )}
          ${kpi(t('st_cache'), pct(s.cacheHitRate), t('kpi_cache_note'))}
        </div>
      <section class="card">
        <div class="card-head"><h2>${t('tok_title')}</h2></div>
        <p class="card-sub" style="margin:-8px 0 12px">${t('tok_sub')}</p>
        <div class="legend-rows" style="margin-top:0">
          ${[['tok_input', tok.input], ['tok_write', tok.cacheWrite], ['tok_read', tok.cacheRead], ['tok_output', tok.output]].map(([k, v]) =>
            `<div class="lrow"><span></span><span>${t(k)}</span><span class="v">${fmtK(v)}</span><span class="p"></span></div>`).join('')}
          ${tok.thinking ? `<div class="lrow sub"><span></span><span>${t('tok_thinking')}</span><span class="v">${fmtK(tok.thinking)}</span><span class="p"></span></div>` : ''}
          <div class="lrow"><span></span><span>${t('st_requests')}</span><span class="v">${s.requests}</span><span class="p"></span></div>
        </div>
      </section>
      </div>
    </div>
    <section class="card">
      <div class="card-head"><h2>${t('recs_title')}</h2></div>
      <div class="recs grid grid-2">${recs.map((r) => recCard(r)).join('') || `<div class="empty">${t('recs_none')}</div>`}</div>
    </section>
    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h2>${t('biggest_title')}</h2></div>
        <p class="card-sub" style="margin:-8px 0 12px">${t('biggest_sub')}</p>
        <div class="items">${(s.biggest || []).map((b) => `<div class="item">
          <span class="sw" style="background:${CAT_COLOR[b.cat] || 'var(--buffer)'}"></span>
          <span class="t" title="${esc(b.label)}">${esc(b.tool || t('row_' + b.cat))}<small>${esc(b.label)}</small></span>
          <span class="v">${fmtK(b.tokens)}</span></div>`).join('')}</div>
      </section>
      <section class="card">
        <div class="card-head"><h2>${t('tools_title')}</h2></div>
        <p class="card-sub" style="margin:-8px 0 12px">${t('tools_sub')}</p>
        <div class="table-wrap"><table>
          <thead><tr><th>${t('col_tool')}</th><th class="r">${t('col_calls')}</th><th class="r">${t('col_ctx')}</th><th class="r">${t('col_errors')}</th></tr></thead>
          <tbody>${(s.tools || []).slice(0, 12).map((x) => `<tr>
            <td>${x.server ? `<span class="badge">MCP</span> ` : ''}<span class="mono small">${esc(x.server ? x.name.split('__').slice(2).join('__') : x.name)}</span>${x.server ? `<div class="cell-sub">${esc(x.server)}</div>` : ''}</td>
            <td class="r num">${x.calls}</td><td class="r num">${fmtK(x.callTokens + x.resultTokens)}</td><td class="r num">${x.errors || '–'}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>
    </div>
      <section class="card">
        <div class="card-head"><h2>${t('sub_title')}</h2></div>
        <p class="card-sub" style="margin:-8px 0 12px">${t('sub_sub')}</p>
        ${(s.subagents || []).length ? `<div class="table-wrap"><table>
          <thead><tr><th>${t('col_agent')}</th><th class="r">${t('col_tools')}</th><th class="r">${t('col_peak')}</th></tr></thead>
          <tbody>${s.subagents.map((a) => `<tr><td><div class="cell-title">${esc(a.description || a.id)}</div><div class="cell-sub">${esc(a.type)}</div></td>
            <td class="r num">${a.toolCalls}</td><td class="r num">${fmtK(a.peak)}</td></tr>`).join('')}</tbody>
        </table></div>` : `<div class="empty small">${t('sub_none')}</div>`}
      </section>
  </div>`;
}

function guideCard(g, i) {
  return `<a class="card guide-card" href="#/guides/${esc(g.file)}">
    <span class="gi">${icon(g.icon || 'book')}</span>
    <span class="step">${t('gd_step', { n: i + 1 })}</span>
    <h3>${esc(g.title)}</h3><p>${esc(g.summary)}</p></a>`;
}

function guidesPage() {
  const list = state.docsIndex[state.lang] || [];
  return `<div class="page-head"><div><h1>${t('gd_title')}</h1><p>${t('gd_sub')}</p></div></div>
    <div class="grid grid-3">${list.map((g, i) => guideCard(g, i)).join('')}</div>`;
}

function cheatsheetPage() {
  const cs = state.cheatsheet;
  const q = state.query.toLowerCase();
  const sections = cs.sections.map((sec) => ({
    ...sec,
    items: sec.items.filter((it) => !q || [it.cmd, L(it.desc), L(it.why)].some((v) => v.toLowerCase().includes(q))),
  })).filter((s) => s.items.length);
  return `<div class="page-head">
      <div><h1>${t('cs_title')}</h1><p>${t('cs_sub')}</p></div>
      <div class="toolbar no-print">
        <input class="input" id="cheat-search" type="search" placeholder="${esc(t('cs_search'))}" value="${esc(state.query)}" aria-label="${esc(t('cs_search'))}">
        <button class="btn primary" type="button" onclick="window.print()">${icon('print')} ${t('cs_print')}</button>
      </div>
    </div>
    <p class="note no-print" style="margin:-8px 0 20px">${icon('info')}<span>${t('cs_verify')}</span></p>
    <div class="cheat-grid">${sections.map((sec) => `<section class="card">
      <div class="card-head"><h2>${esc(L(sec.title))}</h2></div>
      ${sec.items.map((it) => `<div class="cheat-item"><code>${esc(it.cmd)}</code>
        <div><div class="d">${esc(L(it.desc))}</div><div class="w">${esc(L(it.why))}</div>
        ${it.doc ? `<a href="${esc(it.doc)}" target="_blank" rel="noopener noreferrer">docs ↗</a>` : ''}</div></div>`).join('')}
    </section>`).join('') || `<div class="empty">${t('cs_none')}</div>`}</div>`;
}

// ---------- router ----------

let currentRoute = 'overview';
const app = document.getElementById('app');

async function ensure(what) {
  if (what.includes('guide') && !state.guide) state.guide = await getJSON('/data/context-guide.json');
  if (what.includes('docs') && !state.docsIndex[state.lang]) state.docsIndex[state.lang] = await getJSON(`/docs/${state.lang}/index.json`);
  if (what.includes('cheat') && !state.cheatsheet) state.cheatsheet = await getJSON('/data/cheatsheet.json');
  if (what.includes('sessions') && !state.sessions) state.sessions = await getJSON('/api/sessions');
}

async function route() {
  const hash = location.hash || '#/';
  const parts = hash.slice(2).split('/');
  const page = parts[0] || 'overview';
  const prev = currentRoute;
  currentRoute = page === 'session' ? 'sessions' : page;
  if (prev !== currentRoute) state.query = '';
  renderShell(currentRoute);
  app.innerHTML = loadingView();
  try {
    if (page === 'overview' || page === '') {
      await ensure(['guide', 'docs', 'sessions']);
      app.innerHTML = overviewPage();
    } else if (page === 'sessions') {
      await ensure(['guide', 'sessions']);
      app.innerHTML = sessionsPage();
    } else if (page === 'session') {
      await ensure(['guide', 'sessions']);
      const s = await getJSON(`/api/sessions/${encodeURIComponent(parts[1])}`);
      app.innerHTML = sessionPage(s);
      const bd = breakdownOf(s);
      growthChart(document.getElementById('growth'), {
        points: s.timeline, limit: bd.win - bd.buffer,
        compactions: (s.compactionEvents || []).map((c) => c.atRequest), t,
      });
    } else if (page === 'guides' && parts[1]) {
      await ensure(['docs']);
      const list = state.docsIndex[state.lang];
      const file = decodeURIComponent(parts[1]);
      const idx = list.findIndex((g) => g.file === file);
      if (idx < 0) throw new Error('Guide not found');
      const md = await (await fetch(`/docs/${state.lang}/${encodeURIComponent(file)}`)).text();
      const prevG = list[idx - 1], nextG = list[idx + 1];
      app.innerHTML = `<a href="#/guides" class="small no-print">${icon('back')} ${t('gd_all')}</a>
        <article class="prose">${renderMarkdown(md)}</article>
        <nav class="guide-nav">
          ${prevG ? `<a href="#/guides/${esc(prevG.file)}"><small>← ${t('gd_prev')}</small>${esc(prevG.title)}</a>` : '<span></span>'}
          ${nextG ? `<a class="next" href="#/guides/${esc(nextG.file)}"><small>${t('gd_next')} →</small>${esc(nextG.title)}</a>` : '<span></span>'}
        </nav>`;
    } else if (page === 'guides') {
      await ensure(['docs']);
      app.innerHTML = guidesPage();
    } else if (page === 'cheatsheet') {
      await ensure(['cheat']);
      app.innerHTML = cheatsheetPage();
    } else {
      location.hash = '#/';
      return;
    }
    if (prev !== currentRoute) window.scrollTo(0, 0);
  } catch (err) {
    app.innerHTML = errorView(err);
  }
}

// Search boxes re-render their page but keep focus.
document.addEventListener('input', (e) => {
  if (e.target.id !== 'session-search' && e.target.id !== 'cheat-search') return;
  state.query = e.target.value;
  const id = e.target.id;
  const pos = e.target.selectionStart;
  app.innerHTML = id === 'session-search' ? sessionsPage() : cheatsheetPage();
  const el = document.getElementById(id);
  el.focus();
  el.setSelectionRange(pos, pos);
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sort]');
  if (!b) return;
  const k = b.dataset.sort;
  state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : -1 };
  app.innerHTML = sessionsPage();
});

// Refresh session data every 15 seconds while on a sessions view.
setInterval(async () => {
  if (document.hidden || !['overview', 'sessions'].includes(currentRoute)) return;
  if (document.activeElement && document.activeElement.id === 'session-search') return;
  try {
    state.sessions = await getJSON('/api/sessions');
    if (location.hash.startsWith('#/session/')) return; // don't reset a detail view
    app.innerHTML = currentRoute === 'overview' ? overviewPage() : sessionsPage();
  } catch { /* keep the last data */ }
}, 15000);

window.addEventListener('hashchange', route);
applyTheme();
route();
