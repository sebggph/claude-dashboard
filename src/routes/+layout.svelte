<script>
  import '../app.css';
  import TopBar from '#lib/components/TopBar.svelte';
  import Drawer from '#lib/components/Drawer.svelte';
  import Tour from '#lib/components/Tour.svelte';
  import { link, appPath, STATIC_DEMO } from '#lib/paths.js';
  import { setLinkResolver } from '#lib/markdown.js';

  setLinkResolver(link);
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { ui, data, load, t, store } from '#lib/state.svelte.js';
  import { budgetReport, todayUTC } from '#lib/budget.js';
  import { fmtK } from '#lib/rules.js';
  import { fmtUSD } from '#lib/cost.js';
  import { monitorView, monitorAlerts, planReading, planForecast } from '#lib/usage.js';

  let { children } = $props();

  // Theme and language on <html>.
  $effect(() => {
    if (ui.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = ui.theme;
  });
  $effect(() => { document.documentElement.lang = ui.lang; });

  // Data every page can use: explanations, guide list (per language), live facts.
  $effect(() => { load.guide().catch(() => {}); load.live(); });
  $effect(() => { load.docs(ui.lang).catch(() => {}); });

  // Budget notifications: at 80% and 100% of the daily or weekly budget, once each.
  $effect(() => {
    if (!ui.budget.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const r = budgetReport(data.sessions?.sessions, ui.budget, data.live?.pricing?.list);
    const fmt = (v) => (ui.budget.unit === 'tokens' ? fmtK(v) : fmtUSD(v, ui.lang));
    for (const [scope, st] of [['today', r.today], ['week', r.week]]) {
      if (st.level !== 'near' && st.level !== 'over') continue;
      const key = `notified.${scope}.${todayUTC()}.${st.level}`;
      if (store.get(key, '')) continue;
      store.set(key, '1');
      new Notification(t('bud_notify_title_' + st.level), { body: `${t('bud_banner_' + scope)} ${fmt(st.value)} / ${fmt(st.limit)} (${Math.round(st.pct * 100)}%)`, tag: 'ccd-budget-' + scope });
    }
  });

  // Monitor alerts: agents past the restart size, workflow runs past the cost
  // limit. Checked every 20 seconds while any dashboard tab is open.
  $effect(() => {
    if (STATIC_DEMO || !ui.monitor.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const check = async () => {
      try {
        const live = page.route.id === '/monitor' ? data.agents : await load.agents();
        if (!live) return;
        for (const a of monitorAlerts(monitorView(live, data.live?.pricing?.list, Date.now(), ui.monitor))) {
          const key = 'notified.monitor.' + a.key;
          if (store.get(key, '')) continue;
          store.set(key, '1');
          if (a.kind === 'restart') new Notification(t('mon_notify_restart', { k: fmtK(ui.monitor.restartAt) }), { body: t('mon_notify_restart_body', { name: a.name }), tag: 'ccd-' + a.key });
          else new Notification(t('mon_notify_wf', { x: fmtUSD(ui.monitor.workflowUsd, ui.lang) }), { body: t('mon_notify_wf_body', { name: a.name }), tag: 'ccd-' + a.key });
        }
      } catch { /* server busy; try again next time */ }
    };
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  });

  // Weekly plan alerts: at 80%, and when the pace reaches 100% before the
  // reset. Once per week each. Uses the Usage page's data once it's loaded.
  $effect(() => {
    if (!data.usage || !ui.monitor.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let manual = null;
    try { manual = JSON.parse(store.get('plan', 'null')); } catch { /* none */ }
    const f = planForecast(data.usage, planReading(data.usage.plan, manual), data.live?.pricing?.list);
    if (!f || !f.resetsAt) return;
    const when = (ms) => new Date(ms).toLocaleString(ui.lang, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const once = (k, title, body) => { const key = `notified.plan.${k}.${f.resetsAt}`; if (store.get(key, '')) return; store.set(key, '1'); new Notification(title, { body, tag: 'ccd-plan-' + k }); };
    if (f.pct >= 80) once('80', t('pl_notify_80', { p: Math.round(f.pct) }), t('pl_notify_80_body', { when: when(f.resetsAt) }));
    if (f.hitAt) once('hit', t('pl_notify_hit'), t('pl_notify_hit_body', { when: when(f.hitAt) }));
  });

  // Live updates: the server pushes an event when a transcript changes.
  // If the live connection is down, fall back to checking every 15 seconds.
  $effect(() => {
    if (STATIC_DEMO) return; // the online demo has no server
    const es = new EventSource('/api/events');
    es.onopen = () => (data.live_connected = true);
    es.onerror = () => (data.live_connected = false);
    es.addEventListener('sessions', (e) => {
      let evt = {};
      try { evt = JSON.parse(e.data); } catch { /* ignore */ }
      if (data.sessions) load.sessions(true).catch(() => {});
      if (data.usage) load.usage(true).catch(() => {});
      const m = appPath(page.url.pathname).match(/^\/sessions\/([^/]+)$/);
      if (m && (evt.changed || []).includes(decodeURIComponent(m[1]))) invalidateAll();
    });
    const id = setInterval(() => {
      if (!data.live_connected && !document.hidden && data.sessions) load.sessions(true).catch(() => {});
    }, 15000);
    return () => { es.close(); clearInterval(id); };
  });
</script>

<TopBar />
<main id="app" tabindex="-1">
  {@render children()}
</main>
<footer>{t('footer')}</footer>
<Drawer />
<Tour />
