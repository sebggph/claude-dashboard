<script>
  import Icon from '#lib/components/Icon.svelte';
  import { data, t, L } from '#lib/state.svelte.js';

  let query = $state('');
  const sections = $derived.by(() => {
    const q = query.toLowerCase();
    return (data.cheatsheet?.sections || [])
      .map((sec) => ({ ...sec, items: sec.items.filter((it) => !q || [it.cmd, L(it.desc), L(it.why)].some((v) => v.toLowerCase().includes(q))) }))
      .filter((s) => s.items.length);
  });
</script>

<svelte:head><title>{t('cs_title')} · Context Dashboard</title></svelte:head>

<div class="page-head">
  <div><h1>{t('cs_title')}</h1><p>{t('cs_sub')}</p></div>
  <div class="toolbar no-print">
    <input class="input" type="search" placeholder={t('cs_search')} aria-label={t('cs_search')} bind:value={query} />
    <button class="btn primary" type="button" onclick={() => window.print()}><Icon name="print" /> {t('cs_print')}</button>
  </div>
</div>
<p class="note no-print" style="margin:-8px 0 20px"><Icon name="info" /><span>{t('cs_verify')}</span></p>
<div class="cheat-grid">
  {#each sections as sec (sec.id)}
    <section class="card">
      <div class="card-head"><h2>{L(sec.title)}</h2></div>
      {#each sec.items as it (it.cmd)}
        <div class="cheat-item">
          <code>{it.cmd}</code>
          <div>
            <div class="d">{L(it.desc)}</div>
            <div class="w">{L(it.why)}</div>
            {#if it.doc}<a href={it.doc} target="_blank" rel="noopener noreferrer">docs ↗</a>{/if}
          </div>
        </div>
      {/each}
    </section>
  {:else}
    <div class="empty">{t('cs_none')}</div>
  {/each}
</div>
