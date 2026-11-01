<script>
  // Side panel that explains a context category, with tips and doc links.
  import Icon from './Icon.svelte';
  import GuideLink from './GuideLink.svelte';
  import { ui, data, t, L } from '#lib/state.svelte.js';
  import { CAT_GUIDE, guideMeta } from '#lib/rules.js';

  const c = $derived(ui.drawer && data.guide ? data.guide.categories[ui.drawer.key] : null);
  let closeBtn = $state();
  $effect(() => { if (c && closeBtn) closeBtn.focus(); });
  const close = () => (ui.drawer = null);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="drawer-backdrop" class:open={!!c} onclick={close} role="presentation"></div>
<aside class="drawer" class:open={!!c} aria-hidden={!c} role="dialog" aria-modal="true">
  {#if c}
    <button class="icon-btn drawer-close" type="button" aria-label="Close" bind:this={closeBtn} onclick={close}><Icon name="close" /></button>
    <h2>{ui.drawer.label || L(c.label)}</h2>
    <h3>{t('what_is')}</h3>
    <p>{L(c.what)}</p>
    {#if c.tips?.length}
      <h3>{t('how_reduce')}</h3>
      <ul>{#each c.tips as tip, i (i)}<li>{L(tip)}</li>{/each}</ul>
    {/if}
    {#if CAT_GUIDE[ui.drawer.key] && guideMeta(CAT_GUIDE[ui.drawer.key])}
      <h3>{t('guide_in_app')}</h3>
      <p onclick={close} role="presentation"><GuideLink slug={CAT_GUIDE[ui.drawer.key]} /></p>
    {/if}
    {#if c.docs?.length}
      <h3>{t('official_docs')}</h3>
      <ul>{#each c.docs as d (d.url)}<li><a href={d.url} target="_blank" rel="noopener noreferrer">{d.title} ↗</a></li>{/each}</ul>
    {/if}
  {/if}
</aside>
