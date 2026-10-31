// Claude Context Dashboard: front end (vanilla JS, no build step).
import { STRINGS } from './i18n.js';
import { icon } from './icons.js';
import { growthChart, fmtK } from './charts.js';
import { renderMarkdown, inline as mdInline } from './markdown.js';

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
  news: null,
  live: null,
  newsFilter: { source: 'all', context: false },
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
// Live model table from the official docs (when available) wins over the rules.
function liveModel(model) {
  const list = state.live && state.live.models && state.live.models.list;
  if (!model || !list) return null;
  const id = model.toLowerCase().replace(/\[1m\]$/, '').replace(/-\d{8}$/, '');
  return list.find((m) => m.id === id) || null;
}
function windowFor(s) {
  if (state.window !== 'auto') return Number(state.window);
  const lm = liveModel(s.model);
  const w = (s.model && s.model.includes('[1m]')) ? 1000000 : (lm && lm.contextWindow) || nativeWindow(s.model);
  return s.peakTokens > w ? 1000000 : w;
}
const bufferFor = (win) => (win >= 1000000 ? 33000 : 0);

function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

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

  const latest = state.live && state.live.version && state.live.version.latest;
  if (latest && s.version && cmpVersion(s.version, latest) < 0 && s.end && Date.now() - new Date(s.end) < 7 * 86400000) {
    add('outdated_version', 'info', t('why_outdated_version', { v: s.version, l: latest }));
  }

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
      <div class="rec-links">
        ${REC_GUIDE[r.id] ? guideLink(REC_GUIDE[r.id]) : ''}
        ${r.def.doc ? `<a href="${esc(r.def.doc)}" target="_blank" rel="noopener noreferrer">${t('official_docs')} ↗</a>` : ''}
      </div>
    </div>
  </div>`;
}

// ---------- shell: nav, language, theme, settings ----------

const ROUTES = [
  { id: 'home', hash: '#/', icon: 'home' },
  { id: 'overview', hash: '#/dashboard', icon: 'overview' },
  { id: 'sessions', hash: '#/sessions', icon: 'sessions' },
  { id: 'guides', hash: '#/guides', icon: 'book' },
  { id: 'cheatsheet', hash: '#/cheatsheet', icon: 'sheet' },
  { id: 'news', hash: '#/news', icon: 'news' },
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
    ${CAT_GUIDE[key] && guideMeta(CAT_GUIDE[key]) ? `<h3>${t('guide_in_app')}</h3><p>${guideLink(CAT_GUIDE[key])}</p>` : ''}
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

  const allGuides = state.docsIndex[state.lang] || [];
  const guides = [...allGuides.filter((g) => g.section === 'start'), ...allGuides.filter((g) => g.section !== 'start' && !progress.isRead(g.file)), ...allGuides].filter((g, i, arr) => arr.indexOf(g) === i).slice(0, 4);

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
        <div class="grid grid-2">${guides.map((g) => guideCard(g)).join('')}</div>
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

// ---------- learning progress (per browser) ----------
const progress = {
  read() { try { return JSON.parse(store.get('read', '[]')); } catch { return []; } },
  isRead(file) { return this.read().includes(file); },
  markRead(file) { const r = this.read(); if (!r.includes(file)) { r.push(file); store.set('read', JSON.stringify(r)); } },
  tasks(file) { try { return JSON.parse(store.get('tasks.' + file, '{}')); } catch { return {}; } },
  setTask(file, n, on) { const t2 = this.tasks(file); if (on) t2[n] = 1; else delete t2[n]; store.set('tasks.' + file, JSON.stringify(t2)); },
};

// Sections of the Learn page, in order. Each guide's index entry names its section.
const SECTIONS = ['start', 'concepts', 'habits', 'dashboard'];

// Recommendation → in-app guide that explains the fix.
const REC_GUIDE = {
  high_usage: 'compaction.md', frequent_compaction: 'compaction.md', long_session_many_turns: '02-keep-context-lean.md',
  large_tool_results: '02-keep-context-lean.md', many_file_reads: '02-keep-context-lean.md',
  model_switch_midsession: 'change-or-restart.md', idle_cache_expired: 'change-or-restart.md', low_cache_hit: 'change-or-restart.md',
  heavy_thinking: 'change-or-restart.md', big_fixed_overhead: 'optimize-existing-project.md', many_mcp_tools: 'optimize-existing-project.md',
  many_skills: 'optimize-existing-project.md', big_memory_file: '03-claude-md-memory.md',
};
// Context category (drawer) → in-app guide.
const CAT_GUIDE = {
  compaction: 'compaction.md', autocompact_buffer: 'compaction.md', free_space: 'compaction.md', cache: 'change-or-restart.md',
  system_prompt: 'optimize-existing-project.md', system_tools: 'optimize-existing-project.md', mcp_tools: 'optimize-existing-project.md',
  mcp_instructions: 'optimize-existing-project.md', skills: 'optimize-existing-project.md', deferred_tools: '04-mcp-skills-subagents.md',
  memory_files: '03-claude-md-memory.md', tool_results: '02-keep-context-lean.md', tool_calls: '02-keep-context-lean.md',
  thinking: 'change-or-restart.md', messages: '01-what-is-context.md', user_messages: '02-keep-context-lean.md', assistant_text: '01-what-is-context.md',
};
const guideMeta = (file) => (state.docsIndex[state.lang] || []).find((g) => g.file === file);
function guideLink(file) {
  const g = guideMeta(file);
  return g ? `<a href="#/guides/${esc(file)}">${icon('book', 'icon icon-sm')} ${esc(g.title)} →</a>` : '';
}

function guideCard(g, big = false) {
  const done = progress.isRead(g.file);
  const tasks = Object.keys(progress.tasks(g.file)).length;
  return `<a class="card guide-card ${big ? 'big' : ''}" href="#/guides/${esc(g.file)}">
    <span class="gc-top"><span class="gi">${icon(g.icon || 'book')}</span>
      <span class="badge ${g.type === 'tutorial' ? 'accent' : ''}">${t('type_' + (g.type || 'guide'))}</span></span>
    <h3>${esc(g.title)}</h3><p>${esc(g.summary)}</p>
    <span class="gc-meta">
      <span>${g.minutes ? t('min_read', { n: g.minutes }) : ''}${g.level ? ' · ' + t('lvl_' + g.level) : ''}</span>
      ${done ? `<span class="done">${icon('check', 'icon icon-sm')} ${t('read_done')}</span>` : tasks ? `<span class="done">${t('steps_started', { n: tasks })}</span>` : ''}
    </span></a>`;
}

function guidesPage() {
  const list = state.docsIndex[state.lang] || [];
  const read = list.filter((g) => progress.isRead(g.file)).length;
  const bySection = SECTIONS.map((id) => ({ id, items: list.filter((g) => (g.section || 'concepts') === id) })).filter((x) => x.items.length);
  return `<div class="page-head">
      <div><h1>${t('gd_title')}</h1><p>${t('gd_sub')}</p></div>
      <div class="learn-progress"><span>${t('progress_read', { n: read, t: list.length })}</span>
        <span class="track"><span style="width:${list.length ? (read / list.length) * 100 : 0}%"></span></span></div>
    </div>
    <div class="stack">${bySection.map((sec) => `<section>
      <div class="section-head"><h2>${t('sec_' + sec.id)}</h2><p class="muted small">${t('sec_' + sec.id + '_sub')}</p></div>
      <div class="grid ${sec.items.length % 3 === 0 ? 'grid-3' : 'grid-2'}">${sec.items.map((g) => guideCard(g, sec.id === 'start')).join('')}</div>
    </section>`).join('')}</div>`;
}

// The guide currently open (one shared checkbox listener uses it).
let openGuide = null;
document.addEventListener('change', (e) => {
  const cb = e.target.closest && e.target.closest('input[data-task]');
  if (!cb || !openGuide) return;
  progress.setTask(openGuide.file, cb.dataset.task, cb.checked);
  openGuide.renderToc();
});

async function guideReader(file) {
  const list = state.docsIndex[state.lang];
  const idx = list.findIndex((g) => g.file === file);
  if (idx < 0) throw new Error('Guide not found');
  const g = list[idx];
  const md = await (await fetch(`/docs/${state.lang}/${encodeURIComponent(file)}`)).text();
  const ctx = { tasks: 0 };
  const html = renderMarkdown(md, ctx);
  const prevG = list[idx - 1], nextG = list[idx + 1];
  app.innerHTML = `<a href="#/guides" class="small no-print">${icon('back')} ${t('gd_all')}</a>
    <div class="reader">
      <article class="prose" id="article">
        <div class="guide-meta"><span class="badge ${g.type === 'tutorial' ? 'accent' : ''}">${t('type_' + (g.type || 'guide'))}</span>
          <span>${t('sec_' + (g.section || 'concepts'))}</span>${g.minutes ? `<span>· ${t('min_read', { n: g.minutes })}</span>` : ''}${g.level ? `<span>· ${t('lvl_' + g.level)}</span>` : ''}</div>
        ${html}
      </article>
      <aside class="toc no-print" id="toc"></aside>
    </div>
    <nav class="guide-nav">
      ${prevG ? `<a href="#/guides/${esc(prevG.file)}"><small>← ${t('gd_prev')}</small>${esc(prevG.title)}</a>` : '<span></span>'}
      ${nextG ? `<a class="next" href="#/guides/${esc(nextG.file)}"><small>${t('gd_next')} →</small>${esc(nextG.title)}</a>` : '<span></span>'}
    </nav>`;

  // Table of contents + step progress.
  const heads = [...app.querySelectorAll('#article h2')];
  const total = ctx.tasks;
  const toc = document.getElementById('toc');
  const renderToc = () => {
    const done = Object.keys(progress.tasks(file)).length;
    toc.innerHTML = `${total ? `<div class="toc-progress"><b>${t('steps_done', { n: done, t: total })}</b>
        <span class="track"><span style="width:${(done / total) * 100}%"></span></span>
        ${done ? `<button type="button" class="linkish" id="reset-tasks">${t('reset_progress')}</button>` : ''}</div>` : ''}
      ${heads.length > 2 ? `<div class="toc-title">${t('on_this_page')}</div>${heads.map((h) => `<button type="button" class="toc-link" data-target="${esc(h.id)}">${esc(h.textContent)}</button>`).join('')}` : ''}`;
  };
  const saved = progress.tasks(file);
  app.querySelectorAll('input[data-task]').forEach((cb) => { cb.checked = !!saved[cb.dataset.task]; });
  renderToc();
  openGuide = { file, renderToc };
  toc.addEventListener('click', (e) => {
    const l = e.target.closest('.toc-link');
    if (l) document.getElementById(l.dataset.target).scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (e.target.closest('#reset-tasks')) {
      store.set('tasks.' + file, '{}');
      app.querySelectorAll('input[data-task]').forEach((cb) => { cb.checked = false; });
      renderToc();
    }
  });
  // Mark as read once the reader reaches the end.
  const end = app.querySelector('.guide-nav');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => { if (entries.some((x) => x.isIntersecting)) { progress.markRead(file); io.disconnect(); } });
    io.observe(end);
  } else progress.markRead(file);
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

// ---------- home ----------

function homePage() {
  const { sessions } = state.sessions;
  const guides = state.docsIndex[state.lang] || [];
  const read = guides.filter((g) => progress.isRead(g.file)).length;
  const nextGuide = guides.find((g) => !progress.isRead(g.file)) || guides[0];
  const latest = sessions[0];
  const avgUsed = sessions.length ? sessions.reduce((a, x) => a + x.contextTokens / windowFor(x), 0) / sessions.length : 0;
  const cmdCount = state.cheatsheet ? state.cheatsheet.sections.reduce((a, x) => a + x.items.length, 0) : 0;
  const start = guides.filter((g) => g.section === 'start');

  const tile = (href, ic, title, desc, stat) => `<a class="card tile" href="${href}">
      <span class="tile-icon">${icon(ic)}</span>
      <span class="tile-body"><h3>${title}</h3><p>${desc}</p></span>
      <span class="tile-foot"><span class="tile-stat">${stat}</span>${icon('arrow', 'icon icon-sm')}</span>
    </a>`;

  const bd = latest ? breakdownOf(latest) : null;
  return `${banner()}
  <section class="hero card">
    <div class="hero-text">
      <span class="eyebrow">${t('home_eyebrow')}</span>
      <h1>${t('home_title')}</h1>
      <p>${t('home_sub')}</p>
      <div class="hero-cta">
        ${start[0] ? `<a class="btn primary" href="#/guides/${esc(start[0].file)}">${icon('rocket')} ${t('home_cta_start')}</a>` : ''}
        <a class="btn" href="#/dashboard">${icon('overview')} ${t('home_cta_dash')}</a>
      </div>
    </div>
    <div class="hero-side">
      ${latest ? `<a class="snapshot" href="#/session/${esc(latest.id)}">
        <span class="card-sub">${t('home_latest')}</span>
        <span class="snap-title">${esc(latest.title || latest.id)}</span>
        <span class="snap-pct">${t('ctx_used', { p: pctSmart(bd.used / bd.win) })}</span>
        ${stackbar(bd, 10)}
        <span class="card-sub">${fmtK(bd.used)} / ${bd.win >= 1e6 ? '1M' : fmtK(bd.win)} · ${esc(shortModel(latest.model))} · ${ago(latest.end)}</span>
      </a>` : ''}
    </div>
  </section>

  <div class="grid grid-3 tiles">
    ${tile('#/dashboard', 'overview', t('nav_overview'), t('home_t_dash'), t('home_s_dash', { p: pct(avgUsed) }))}
    ${tile('#/sessions', 'sessions', t('nav_sessions'), t('home_t_sessions'), t(sessions.length === 1 ? 'home_s_session_one' : 'home_s_sessions', { n: sessions.length }))}
    ${tile('#/guides', 'book', t('nav_guides'), t('home_t_learn'), t('progress_read', { n: read, t: guides.length }))}
    ${tile('#/cheatsheet', 'sheet', t('nav_cheatsheet'), t('home_t_cheat'), t('home_s_cheat', { n: cmdCount }))}
    ${tile('#/news', 'news', t('nav_news'), t('home_t_news'), `<span id="home-news-stat">${t('home_s_news')}</span>`)}
    ${tile('#/guides/06-reading-the-dashboard.md', 'chart', t('home_t_help_title'), t('home_t_help'), t('min_read', { n: 4 }))}
  </div>

  <div class="grid grid-2">
    <section class="card">
      <div class="card-head"><h2>${t('home_whatsnew')}</h2><a class="small" href="#/news">${t('see_all')} →</a></div>
      <div id="home-news">${homeNews()}</div>
    </section>
    <section class="card">
      <div class="card-head"><h2>${t('home_continue')}</h2><a class="small" href="#/guides">${t('see_all')} →</a></div>
      <div class="learn-progress" style="margin-bottom:14px"><span>${t('progress_read', { n: read, t: guides.length })}</span>
        <span class="track"><span style="width:${guides.length ? (read / guides.length) * 100 : 0}%"></span></span></div>
      <div class="home-next">${nextGuide ? guideCard(nextGuide) : ''}</div>
    </section>
  </div>`;
}

function homeNews() {
  const n = state.news;
  if (!n) return `<div class="empty small">${t('loading')}</div>`;
  const stat = document.getElementById('home-news-stat');
  const cc = (n.releases || []).find((r) => r.source === 'claude-code');
  if (stat && cc) stat.textContent = t('home_s_news_v', { v: cc.version });
  const items = [];
  for (const r of n.releases || []) {
    for (const g of r.groups) for (const it of g.items) if (it.tags.includes('context') && g.type !== 'fixed') items.push({ r, it });
    if (items.length >= 4) break;
  }
  if (!items.length) return `<div class="empty small">${t('news_empty')}</div>`;
  return `<div class="news-mini">${items.slice(0, 4).map(({ r, it }) => `<div class="nm-item">
      <span class="badge">${r.version ? 'v' + esc(r.version) : esc(sourceName(r.source))}</span>
      <span class="nm-text">${mdInline(it.text)}</span>
      <span class="card-sub">${fmtDate(r.date)}</span></div>`).join('')}</div>`;
}

// ---------- news ----------

const sourceName = (id) => ({ 'claude-code': 'Claude Code', platform: 'Claude Platform' }[id] || id);
function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00Z').toLocaleDateString(state.lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch { return d; }
}

async function loadNews(force = false) {
  try { state.news = await getJSON('/api/news' + (force ? '?refresh=1' : '')); } catch (e) { state.news = state.news || { error: e.message, releases: [], sources: [] }; }
}

function newsPage() {
  const n = state.news;
  const f = state.newsFilter;
  const q = state.query.toLowerCase();
  const head = `<div class="page-head">
      <div><h1>${t('news_title')}</h1><p>${t('news_sub')}</p></div>
      <div class="toolbar">
        <span class="small muted">${n && n.updated ? t('news_checked', { x: ago(n.updated) }) : ''}</span>
        <button class="btn" type="button" id="news-refresh" ${n && n.disabled ? 'disabled' : ''}>${icon('refresh')} ${t('news_refresh')}</button>
      </div>
    </div>`;
  if (!n) return head + loadingView();
  const filters = `<div class="toolbar news-filters">
      <div class="seg" role="group" aria-label="${esc(t('news_source'))}">
        ${['all', 'claude-code', 'platform'].map((id) => `<button type="button" data-news-source="${id}" aria-pressed="${f.source === id}">${id === 'all' ? t('news_all') : sourceName(id)}</button>`).join('')}
      </div>
      <button type="button" class="chip-toggle" data-news-context aria-pressed="${f.context}">${icon('gauge', 'icon icon-sm')} ${t('news_context_only')}</button>
      <input class="input" id="news-search" type="search" placeholder="${esc(t('news_search'))}" value="${esc(state.query)}" aria-label="${esc(t('news_search'))}">
    </div>`;
  const notes = [];
  if (n.disabled) notes.push(t('news_disabled'));
  else if (n.offline) notes.push(t('news_offline'));
  for (const src of n.sources || []) if (!src.ok && !n.offline) notes.push(t('news_source_failed', { s: src.name }));
  if (state.lang !== 'en') notes.push(t('news_lang'));

  const releases = (n.releases || []).filter((r) => f.source === 'all' || r.source === f.source).map((r) => ({
    ...r,
    groups: r.groups.map((g) => ({ ...g, items: g.items.filter((it) => (!f.context || it.tags.includes('context')) && (!q || it.text.toLowerCase().includes(q))) })).filter((g) => g.items.length),
  })).filter((r) => r.groups.length);

  const groupLabel = (g) => t('news_g_' + g.type) !== 'news_g_' + g.type ? t('news_g_' + g.type) : g.label;
  const srcPage = (id) => ((n.sources || []).find((x) => x.id === id) || {}).page;
  return `${head}${liveCards()}${filters}
    ${notes.map((x) => `<div class="banner">${icon('info')}<span>${esc(x)}</span></div>`).join('')}
    <div class="news-list">${releases.slice(0, 30).map((r) => `<article class="card release">
      <div class="release-head">
        <div class="release-title"><span class="badge ${r.source === 'claude-code' ? 'accent' : ''}">${sourceName(r.source)}</span>
          <h2>${r.version ? 'v' + esc(r.version) : fmtDate(r.date)}</h2></div>
        <div class="release-meta"><span class="card-sub">${r.version ? fmtDate(r.date) : ''}</span>
          ${srcPage(r.source) ? `<a class="small" href="${esc(srcPage(r.source))}" target="_blank" rel="noopener noreferrer">${t('news_open')} ↗</a>` : ''}</div>
      </div>
      ${r.groups.map((g) => {
        const shown = g.items.slice(0, 6), more = g.items.slice(6);
        const li = (it) => `<li class="${it.tags.includes('context') ? 'ctx' : ''}"><span>${mdInline(it.text)}</span>${it.tags.includes('context') ? `<span class="tag">${t('news_tag_context')}</span>` : ''}</li>`;
        return `<div class="rgroup"><h3><span class="gdot g-${esc(g.type)}"></span>${esc(groupLabel(g))} <span class="card-sub">${g.items.length}</span></h3>
          <ul>${shown.map(li).join('')}</ul>
          ${more.length ? `<details><summary>${t('news_more', { n: more.length })}</summary><ul>${more.map(li).join('')}</ul></details>` : ''}</div>`;
      }).join('')}
    </article>`).join('') || `<div class="card empty">${t('news_none')}</div>`}</div>`;
}

function liveCards() {
  const L2 = state.live || {};
  const models = L2.models && L2.models.list;
  const v = L2.version && L2.version.latest;
  const st = L2.status && !L2.status.error && L2.status.indicator ? L2.status : null;
  const mine = state.sessions && state.sessions.sessions.map((x) => x.version).filter(Boolean).sort(cmpVersion).pop();
  const stColor = { none: 'var(--good)', minor: 'var(--warning)', major: 'var(--serious)', critical: 'var(--critical)' };
  return `<div class="grid grid-2 live-row">
    <section class="card">
      <div class="card-head"><h2>${t('live_models')}</h2>${L2.models && L2.models.page ? `<a class="small" href="${esc(L2.models.page)}" target="_blank" rel="noopener noreferrer">${t('news_open_docs')} ↗</a>` : ''}</div>
      ${models ? `<div class="table-wrap"><table>
        <thead><tr><th>${t('col_model')}</th><th class="r">${t('live_ctx')}</th><th class="r">${t('live_out')}</th><th>${t('live_effort')}</th></tr></thead>
        <tbody>${models.map((m) => `<tr><td><div class="cell-title">${m.page ? `<a href="${esc(m.page)}" target="_blank" rel="noopener noreferrer">${esc(m.name)}</a>` : esc(m.name)}</div><div class="cell-sub mono">${esc(m.id)}</div></td>
          <td class="r num">${m.contextWindow ? fmtK(m.contextWindow) : '–'}</td><td class="r num">${m.maxOutput ? fmtK(m.maxOutput) : '–'}</td><td><span class="badge">${esc(m.defaultEffort || '–')}</span></td></tr>`).join('')}</tbody>
      </table></div><p class="note">${icon('info')}<span>${t('live_models_note')}</span></p>` : `<div class="empty small">${t('live_unavailable')}</div>`}
    </section>
    <section class="card live-side">
      <div class="card-head"><h2>Claude Code</h2>${L2.version && L2.version.page ? `<a class="small" href="${esc(L2.version.page)}" target="_blank" rel="noopener noreferrer">${t('news_open')} ↗</a>` : ''}</div>
      <div class="grid grid-2">
        <div class="kpi"><span class="kpi-label">${t('live_latest')}</span><span class="kpi-value">${v ? 'v' + esc(v) : '–'}</span></div>
        <div class="kpi"><span class="kpi-label">${t('live_yours')}</span><span class="kpi-value">${mine ? 'v' + esc(mine) : '–'}</span>
          <span class="kpi-note">${mine && v ? (cmpVersion(mine, v) < 0 ? t('live_behind') : t('live_uptodate')) : ''}</span></div>
      </div>
      ${(() => {
        const rel = state.news && state.news.releases ? state.news.releases.filter((r) => r.source === 'claude-code' && r.version) : [];
        const newer = mine ? rel.filter((r) => cmpVersion(r.version, mine) > 0) : [];
        const ctx = newer.reduce((a, r) => a + r.groups.reduce((b, g) => b + g.items.filter((i) => i.tags.includes('context')).length, 0), 0);
        return `<div class="legend-rows" style="margin-top:0">
          ${mine ? `<div class="lrow"><span></span><span>${t('live_since')}</span><span class="v">${newer.length}</span><span class="p"></span></div>
          <div class="lrow"><span></span><span>${t('live_since_ctx')}</span><span class="v">${ctx}</span><span class="p"></span></div>` : ''}
          <div class="lrow"><span></span><span>${t('live_check_how')}</span><span class="v" style="grid-column: span 2"><code>claude --version</code></span></div>
          ${mine && v && cmpVersion(mine, v) < 0 ? `<div class="lrow"><span></span><span>${t('live_update_how')}</span><span class="v" style="grid-column: span 2"><code>claude update</code></span></div>` : ''}
        </div>`;
      })()}
      ${st ? `<div class="status-box">
        <div class="status"><span class="dot" style="background:${stColor[st.indicator] || 'var(--text-3)'}"></span>${esc(st.description || st.indicator)}
          <a class="small" href="${esc(st.page)}" target="_blank" rel="noopener noreferrer">${t('live_status_page')} ↗</a></div>
        ${(st.incidents || []).map((x) => `<div class="small muted">• ${esc(x.name)} (${esc(x.status)})</div>`).join('')}
      </div>` : ''}
    </section>
  </div>`;
}

document.addEventListener('click', async (e) => {
  const src = e.target.closest('[data-news-source]');
  if (src) { state.newsFilter.source = src.dataset.newsSource; app.innerHTML = newsPage(); return; }
  if (e.target.closest('[data-news-context]')) { state.newsFilter.context = !state.newsFilter.context; app.innerHTML = newsPage(); return; }
  const rb = e.target.closest('#news-refresh');
  if (rb) { rb.disabled = true; rb.classList.add('spinning'); await loadNews(true); if (currentRoute === 'news') app.innerHTML = newsPage(); }
});

// ---------- router ----------

let currentRoute = 'home';
const app = document.getElementById('app');

async function ensure(what) {
  if (what.includes('guide') && !state.guide) state.guide = await getJSON('/data/context-guide.json');
  if (what.includes('docs') && !state.docsIndex[state.lang]) state.docsIndex[state.lang] = await getJSON(`/docs/${state.lang}/index.json`);
  if (what.includes('cheat') && !state.cheatsheet) state.cheatsheet = await getJSON('/data/cheatsheet.json');
  if (what.includes('sessions') && !state.sessions) state.sessions = await getJSON('/api/sessions');
  if (what.includes('live') && !state.live) { try { state.live = await getJSON('/api/live'); } catch { state.live = {}; } }
}

async function route() {
  const hash = location.hash || '#/';
  const parts = hash.slice(2).split('/');
  const page = parts[0] || 'home';
  const prev = currentRoute;
  currentRoute = page === 'session' ? 'sessions' : page === 'dashboard' ? 'overview' : page;
  if (prev !== currentRoute) state.query = '';
  renderShell(currentRoute);
  app.innerHTML = loadingView();
  try {
    if (page === 'home') {
      await ensure(['docs', 'sessions', 'cheat', 'live']);
      app.innerHTML = homePage();
      loadNews().then(() => { if (currentRoute === 'home') { const el = document.getElementById('home-news'); if (el) el.innerHTML = homeNews(); } });
    } else if (page === 'dashboard') {
      await ensure(['guide', 'docs', 'sessions', 'live']);
      app.innerHTML = overviewPage();
    } else if (page === 'news') {
      await ensure(['live', 'sessions']);
      app.innerHTML = newsPage();
      await loadNews();
      if (currentRoute === 'news') app.innerHTML = newsPage();
    } else if (page === 'sessions') {
      await ensure(['guide', 'docs', 'sessions', 'live']);
      app.innerHTML = sessionsPage();
    } else if (page === 'session') {
      await ensure(['guide', 'docs', 'sessions', 'live']);
      const s = await getJSON(`/api/sessions/${encodeURIComponent(parts[1])}`);
      app.innerHTML = sessionPage(s);
      const bd = breakdownOf(s);
      growthChart(document.getElementById('growth'), {
        points: s.timeline, limit: bd.win - bd.buffer,
        compactions: (s.compactionEvents || []).map((c) => c.atRequest), t,
      });
    } else if (page === 'guides' && parts[1]) {
      await ensure(['docs']);
      await guideReader(decodeURIComponent(parts[1]));
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
  if (!['session-search', 'cheat-search', 'news-search'].includes(e.target.id)) return;
  state.query = e.target.value;
  const id = e.target.id;
  const pos = e.target.selectionStart;
  app.innerHTML = id === 'session-search' ? sessionsPage() : id === 'news-search' ? newsPage() : cheatsheetPage();
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
