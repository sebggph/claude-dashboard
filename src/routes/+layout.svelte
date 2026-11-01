<script>
  import '../app.css';
  import TopBar from '#lib/components/TopBar.svelte';
  import Drawer from '#lib/components/Drawer.svelte';
  import Tour from '#lib/components/Tour.svelte';
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { ui, data, load, t, store } from '#lib/state.svelte.js';
  import { budgetReport, todayUTC } from '#lib/budget.js';
  import { fmtK } from '#lib/rules.js';
  import { fmtUSD } from '#lib/cost.js';

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

  // Live updates: the server pushes an event when a transcript changes.
  // If the live connection is down, fall back to checking every 15 seconds.
  $effect(() => {
    const es = new EventSource('/api/events');
    es.onopen = () => (data.live_connected = true);
    es.onerror = () => (data.live_connected = false);
    es.addEventListener('sessions', (e) => {
      let evt = {};
      try { evt = JSON.parse(e.data); } catch { /* ignore */ }
      if (data.sessions) load.sessions(true).catch(() => {});
      const m = page.url.pathname.match(/^\/sessions\/([^/]+)$/);
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
