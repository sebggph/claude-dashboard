<script>
  // The /context-style card: % used, stacked bar and a detailed list.
  import Icon from './Icon.svelte';
  import Explain from './Explain.svelte';
  import StackBar from './StackBar.svelte';
  import { ui, t } from '#lib/state.svelte.js';
  import { breakdownOf, GUIDE_KEY, fmtK, pctSmart, shortModel, winLabel } from '#lib/rules.js';
  let { session } = $props();
  const bd = $derived(breakdownOf(session));
</script>

<section class="card">
  <div class="card-head">
    <h2>{t('ctx_title')}</h2>
    <span class="card-sub">{shortModel(session.model)} · {winLabel(bd.win)}{ui.window === 'auto' ? ` (${t('window_auto')})` : ''}</span>
  </div>
  <div class="ctx-top">
    <span class="ctx-pct">{t('ctx_used', { p: pctSmart(bd.used / bd.win) })}</span>
    <span class="ctx-of">{fmtK(bd.used)} / {winLabel(bd.win)}</span>
  </div>
  <StackBar {bd} />
  <div class="legend-rows">
    {#each bd.groups as g (g.id)}
      {#if g.rows.length === 1}
        <div class="lrow">
          <span class="sw" style:background={g.color}></span>
          <Explain key={GUIDE_KEY[g.rows[0].id]} label={t('row_' + g.rows[0].id)} />
          <span class="v">{fmtK(g.tokens)}</span><span class="p">{pctSmart(g.tokens / bd.win)}</span>
        </div>
      {:else}
        <div class="lrow group">
          <span class="sw" style:background={g.color}></span><span>{t('grp_' + g.id)}</span>
          <span class="v">{fmtK(g.tokens)}</span><span class="p">{pctSmart(g.tokens / bd.win)}</span>
        </div>
        {#each g.rows as r (r.id)}
          <div class="lrow sub">
            <span></span><Explain key={GUIDE_KEY[r.id]} label={t('row_' + r.id)} />
            <span class="v">{fmtK(r.tokens)}</span><span class="p">{pctSmart(r.tokens / bd.win)}</span>
          </div>
        {/each}
      {/if}
    {/each}
    {#if bd.buffer}
      <div class="lrow group">
        <span class="sw buffer"></span><Explain key="autocompact_buffer" label={t('row_buffer')} />
        <span class="v">{fmtK(bd.buffer)}</span><span class="p">{pctSmart(bd.buffer / bd.win)}</span>
      </div>
    {/if}
    <div class="lrow">
      <span class="sw hollow"></span><Explain key="free_space" label={t('row_free')} />
      <span class="v">{fmtK(bd.free)}</span><span class="p">{pctSmart(bd.free / bd.win)}</span>
    </div>
  </div>
  <p class="note"><Icon name="info" /><span>{t('ctx_note')}</span></p>
</section>
