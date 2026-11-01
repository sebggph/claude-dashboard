<script>
  import GuideCard from '#lib/components/GuideCard.svelte';
  import { ui, data, t, progress } from '#lib/state.svelte.js';
  import { SECTIONS, slugOf } from '#lib/rules.js';

  const list = $derived(data.docsIndex[ui.lang] || []);
  const read = $derived(list.filter((g) => progress.isRead(slugOf(g.file))).length);
  const sections = $derived(SECTIONS.map((id) => ({ id, items: list.filter((g) => (g.section || 'concepts') === id) })).filter((x) => x.items.length));
</script>

<svelte:head><title>{t('gd_title')} · Context Dashboard</title></svelte:head>

<div class="page-head">
  <div><h1>{t('gd_title')}</h1><p>{t('gd_sub')}</p></div>
  <div class="learn-progress">
    <span>{t('progress_read', { n: read, t: list.length })}</span>
    <span class="track"><span style:width="{list.length ? (read / list.length) * 100 : 0}%"></span></span>
  </div>
</div>
<div class="stack">
  {#each sections as sec (sec.id)}
    <section>
      <div class="section-head"><h2>{t('sec_' + sec.id)}</h2><p class="muted small">{t('sec_' + sec.id + '_sub')}</p></div>
      <div class="grid" class:grid-3={sec.items.length % 3 === 0} class:grid-2={sec.items.length % 3 !== 0}>
        {#each sec.items as g (g.file)}<GuideCard guide={g} big={sec.id === 'start'} />{/each}
      </div>
    </section>
  {/each}
</div>
