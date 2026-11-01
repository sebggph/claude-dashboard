<script>
  import '../app.css';
  import TopBar from '#lib/components/TopBar.svelte';
  import Drawer from '#lib/components/Drawer.svelte';
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { ui, data, load, t } from '#lib/state.svelte.js';

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
