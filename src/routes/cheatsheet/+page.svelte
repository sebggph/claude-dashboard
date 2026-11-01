<script>
  import Icon from '#lib/components/Icon.svelte';
  import { data, t, L } from '#lib/state.svelte.js';
  import Quiz from '#lib/components/Quiz.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';

  const mode = $derived(page.url.searchParams.get('mode') === 'quiz' ? 'quiz' : 'list');
  const setMode = (m) => goto(m === 'quiz' ? '?mode=quiz' : '?', { replaceState: true, noScroll: true, keepFocus: true });

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
  {#if mode === 'list'}
  <div class="toolbar no-print">
    <input class="input" type="search" placeholder={t('cs_search')} aria-label={t('cs_search')} bind:value={query} />
    <button class="btn primary" type="button" onclick={() => window.print()}><Icon name="print" /> {t('cs_print')}</button>
  </div>
  {/if}
</div>
<div class="seg view-tabs no-print" role="tablist" aria-label={t('qz_views')}>
  <button type="button" role="tab" aria-selected={mode === 'list'} aria-pressed={mode === 'list'} onclick={() => setMode('list')}>{t('qz_reference')}</button>
  <button type="button" role="tab" aria-selected={mode === 'quiz'} aria-pressed={mode === 'quiz'} onclick={() => setMode('quiz')}>{t('qz_quiz')}</button>
</div>

{#if mode === 'quiz'}
  <Quiz sections={data.cheatsheet?.sections || []} />
{:else}
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
{/if}
