<script>
  import Icon from '#lib/components/Icon.svelte';
  import LiveCards from '#lib/components/LiveCards.svelte';
  import { ui, data, load, t } from '#lib/state.svelte.js';
  import { ago, fmtDate, sourceName } from '#lib/rules.js';
  import { inline } from '#lib/markdown.js';

  let source = $state('all');
  let contextOnly = $state(false);
  let query = $state('');
  let refreshing = $state(false);

  const n = $derived(data.news);
  const notes = $derived.by(() => {
    const out = [];
    if (!n) return out;
    if (n.disabled) out.push(t('news_disabled'));
    else if (n.offline) out.push(t('news_offline'));
    for (const s of n.sources || []) if (!s.ok && !n.offline) out.push(t('news_source_failed', { s: s.name }));
    if (ui.lang !== 'en') out.push(t('news_lang'));
    return out;
  });
  const releases = $derived.by(() => {
    const q = query.toLowerCase();
    return (n?.releases || [])
      .filter((r) => source === 'all' || r.source === source)
      .map((r) => ({ ...r, groups: r.groups.map((g) => ({ ...g, items: g.items.filter((it) => (!contextOnly || it.tags.includes('context')) && (!q || it.text.toLowerCase().includes(q))) })).filter((g) => g.items.length) }))
      .filter((r) => r.groups.length)
      .slice(0, 30);
  });
  const groupLabel = (g) => { const k = 'news_g_' + g.type; const v = t(k); return v !== k ? v : g.label; };
  const srcPage = (id) => ((n?.sources || []).find((x) => x.id === id) || {}).page;

  async function refresh() { refreshing = true; await load.news(true); refreshing = false; }
</script>

<svelte:head><title>{t('news_title')} · Context Dashboard</title></svelte:head>

<div class="page-head">
  <div><h1>{t('news_title')}</h1><p>{t('news_sub')}</p></div>
  <div class="toolbar">
    {#if n?.updated}<span class="small muted">{t('news_checked', { x: ago(n.updated) })}</span>{/if}
    <button class="btn" class:spinning={refreshing} type="button" disabled={refreshing || n?.disabled} onclick={refresh}><Icon name="refresh" /> {t('news_refresh')}</button>
  </div>
</div>

<LiveCards />

<div class="toolbar news-filters">
  <div class="seg" role="group" aria-label={t('news_source')}>
    {#each ['all', 'claude-code', 'platform'] as id (id)}
      <button type="button" aria-pressed={source === id} onclick={() => (source = id)}>{id === 'all' ? t('news_all') : sourceName(id)}</button>
    {/each}
  </div>
  <button type="button" class="chip-toggle" aria-pressed={contextOnly} onclick={() => (contextOnly = !contextOnly)}><Icon name="gauge" small /> {t('news_context_only')}</button>
  <input class="input" type="search" placeholder={t('news_search')} aria-label={t('news_search')} bind:value={query} />
</div>

{#each notes as note (note)}<div class="banner"><Icon name="info" /><span>{note}</span></div>{/each}

<div class="news-list">
  {#each releases as r (r.source + (r.version || r.date))}
    <article class="card release">
      <div class="release-head">
        <div class="release-title">
          <span class="badge" class:accent={r.source === 'claude-code'}>{sourceName(r.source)}</span>
          <h2>{r.version ? 'v' + r.version : fmtDate(r.date)}</h2>
        </div>
        <div class="release-meta">
          <span class="card-sub">{r.version ? fmtDate(r.date) : ''}</span>
          {#if srcPage(r.source)}<a class="small" href={srcPage(r.source)} target="_blank" rel="noopener noreferrer">{t('news_open')} ↗</a>{/if}
        </div>
      </div>
      {#each r.groups as g (g.label)}
        <div class="rgroup">
          <h3><span class="gdot g-{g.type}"></span>{groupLabel(g)} <span class="card-sub">{g.items.length}</span></h3>
          <ul>
            {#each g.items.slice(0, 6) as it, i (i)}
              <li class:ctx={it.tags.includes('context')}><span>{@html inline(it.text)}</span>{#if it.tags.includes('context')}<span class="tag">{t('news_tag_context')}</span>{/if}</li>
            {/each}
          </ul>
          {#if g.items.length > 6}
            <details>
              <summary>{t('news_more', { n: g.items.length - 6 })}</summary>
              <ul>
                {#each g.items.slice(6) as it, i (i)}
                  <li class:ctx={it.tags.includes('context')}><span>{@html inline(it.text)}</span>{#if it.tags.includes('context')}<span class="tag">{t('news_tag_context')}</span>{/if}</li>
                {/each}
              </ul>
            </details>
          {/if}
        </div>
      {/each}
    </article>
  {:else}
    <div class="card empty">{n ? t('news_none') : t('loading')}</div>
  {/each}
</div>
