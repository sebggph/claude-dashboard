// App-wide state (Svelte 5 runes): preferences, loaded data and translations.
import { STRINGS } from './i18n.js';
import { apiURL, file } from './paths.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem('ccd.' + k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ccd.' + k, v); } catch { /* private mode */ } },
};
export { store };

const browserLang = typeof navigator !== 'undefined' && (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';

const BUDGET_DEFAULT = { unit: 'cost', daily: null, weekly: null, session: null, notify: false };
function loadBudget() {
  try { return { ...BUDGET_DEFAULT, ...JSON.parse(store.get('budget', '{}')) }; } catch { return { ...BUDGET_DEFAULT }; }
}

/** Preferences, saved per browser. */
export const ui = $state({
  lang: store.get('lang', browserLang),
  theme: store.get('theme', 'auto'), // auto | light | dark
  window: store.get('window', 'auto'), // auto | 200000 | 1000000
  privacy: store.get('privacy', 'off') === 'on', // hide titles, paths and prompt text
  budget: loadBudget(), // { unit: 'cost' | 'tokens', daily, weekly, session, notify }
  drawer: null, // { key, label } of the open explanation
  readVersion: 0, // bumps when learning progress changes
  tour: null, // index of the current guided-tour step, or null
});

export function setLang(l) { ui.lang = l; store.set('lang', l); }
export function cycleTheme() { ui.theme = { auto: 'light', light: 'dark', dark: 'auto' }[ui.theme]; store.set('theme', ui.theme); }
export function setWindow(w) { ui.window = w; store.set('window', w); }
export function saveBudget(patch) { ui.budget = { ...ui.budget, ...patch }; store.set('budget', JSON.stringify(ui.budget)); }
export function startTour() { ui.tour = 0; }
export function endTour() { ui.tour = null; store.set('tourDone', '1'); }
export function togglePrivacy() { ui.privacy = !ui.privacy; store.set('privacy', ui.privacy ? 'on' : 'off'); }

/** Data loaded from the server and static files. */
export const data = $state({
  sessions: null, // /api/sessions
  guide: null, // context-guide.json
  cheatsheet: null,
  docsIndex: {}, // per language
  news: null,
  live: null,
  live_connected: false, // live-update stream is open
  error: null,
});

async function getJSON(url) {
  const r = await fetch(apiURL(url), { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

export const load = {
  async sessions(force = false) { if (force || !data.sessions) data.sessions = await getJSON('/api/sessions'); return data.sessions; },
  async guide() { if (!data.guide) data.guide = await getJSON('/data/context-guide.json'); return data.guide; },
  async cheatsheet() { if (!data.cheatsheet) data.cheatsheet = await getJSON('/data/cheatsheet.json'); return data.cheatsheet; },
  async docs(lang = ui.lang) { if (!data.docsIndex[lang]) data.docsIndex[lang] = await getJSON(`/docs/${lang}/index.json`); return data.docsIndex[lang]; },
  async news(force = false) {
    try { data.news = await getJSON('/api/news' + (force ? '?refresh=1' : '')); } catch (e) { data.news = data.news || { error: e.message, releases: [], sources: [] }; }
    return data.news;
  },
  async live() { if (!data.live) { try { data.live = await getJSON('/api/live'); } catch { data.live = {}; } } return data.live; },
  session: (id) => getJSON(`/api/sessions/${encodeURIComponent(id)}`),
  guideText: async (lang, slug) => {
    const r = await fetch(file(`/docs/${lang}/${encodeURIComponent(slug)}.md`));
    if (!r.ok) throw new Error('Guide not found');
    return r.text();
  },
};

/** Translate a UI string. Reactive: re-renders when ui.lang changes. */
export function t(key, vars = {}) {
  const s = (STRINGS[ui.lang] && STRINGS[ui.lang][key]) ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
/** Pick the current language from a {en, es} object. */
export const L = (obj) => (obj ? obj[ui.lang] ?? obj.en ?? '' : '');

/** Learning progress (per browser). */
export const progress = {
  read() { void ui.readVersion; try { return JSON.parse(store.get('read', '[]')); } catch { return []; } },
  isRead(slug) { return this.read().includes(slug); },
  markRead(slug) { const r = this.read(); if (!r.includes(slug)) { r.push(slug); store.set('read', JSON.stringify(r)); ui.readVersion++; } },
  tasks(slug) { void ui.readVersion; try { return JSON.parse(store.get('tasks.' + slug, '{}')); } catch { return {}; } },
  setTask(slug, n, on) { const x = this.tasks(slug); if (on) x[n] = 1; else delete x[n]; store.set('tasks.' + slug, JSON.stringify(x)); ui.readVersion++; },
  resetTasks(slug) { store.set('tasks.' + slug, '{}'); ui.readVersion++; },
};
