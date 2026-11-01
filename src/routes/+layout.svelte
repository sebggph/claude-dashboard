<script>
  import '../app.css';
  import TopBar from '#lib/components/TopBar.svelte';
  import Drawer from '#lib/components/Drawer.svelte';
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

  // Keep session data fresh while the tab is visible.
  $effect(() => {
    const id = setInterval(() => { if (!document.hidden && data.sessions) load.sessions(true).catch(() => {}); }, 15000);
    return () => clearInterval(id);
  });
</script>

<TopBar />
<main id="app" tabindex="-1">
  {@render children()}
</main>
<footer>{t('footer')}</footer>
<Drawer />
