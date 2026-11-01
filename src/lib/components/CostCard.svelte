<script>
  // Estimated cost at API prices, and what prompt caching saved.
  import Icon from './Icon.svelte';
  import Explain from './Explain.svelte';
  import { ui, data, t } from '#lib/state.svelte.js';
  import { costOf, fmtUSD } from '#lib/cost.js';
  let { buckets } = $props();
  const pricing = $derived(data.live?.pricing?.list);
  const c = $derived(pricing ? costOf(buckets, pricing) : null);
  const savedPct = $derived(c && c.withoutCache ? c.saved / c.withoutCache : 0);
</script>

<section class="card">
  <div class="card-head"><h2>{t('cost_title')}</h2>
    {#if data.live?.pricing?.page}<a class="small" href={data.live.pricing.page} target="_blank" rel="noopener noreferrer">{t('cost_prices')} ↗</a>{/if}</div>
  {#if c}
    <div class="grid grid-2 cost-top">
      <div class="kpi"><span class="kpi-label">{t('cost_est')}</span><span class="kpi-value">{fmtUSD(c.usd, ui.lang)}</span></div>
      <div class="kpi"><span class="kpi-label"><Explain key="cache" label={t('cost_saved')} /></span><span class="kpi-value saved">{fmtUSD(c.saved, ui.lang)}</span>
        <span class="kpi-note">{t('cost_saved_note', { p: Math.round(savedPct * 100) + '%', x: fmtUSD(c.withoutCache, ui.lang) })}</span></div>
    </div>
    <div class="legend-rows" style="margin-top:8px">
      {#each [['tok_input', c.parts.input], ['tok_write', c.parts.cacheWrite], ['tok_read', c.parts.cacheRead], ['tok_output', c.parts.output]] as [k, v] (k)}
        <div class="lrow"><span></span><span>{t(k)}</span><span class="v">{fmtUSD(v, ui.lang)}</span><span class="p">{c.usd ? Math.round((v / c.usd) * 100) + '%' : ''}</span></div>
      {/each}
    </div>
    {#if c.unknown.length}<p class="note"><Icon name="info" /><span>{t('cost_unknown', { m: c.unknown.join(', ') })}</span></p>{/if}
    <p class="note"><Icon name="info" /><span>{t('cost_note')}</span></p>
  {:else}
    <div class="empty small">{t('cost_unavailable')}</div>
  {/if}
</section>
