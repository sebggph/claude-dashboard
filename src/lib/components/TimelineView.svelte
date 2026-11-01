<script>
  import { link } from '#lib/paths.js';
  // Step through a session request by request: what was added, and how much
  // the context grew. Click the chart or use ← → to move.
  import Icon from './Icon.svelte';
  import GrowthChart from './GrowthChart.svelte';
  import { ui, t } from '#lib/state.svelte.js';
  import { breakdownOf, CAT_COLOR, fmtK, maskText } from '#lib/rules.js';
  let { session } = $props();

  const steps = $derived(session.steps || []);
  const n = $derived(steps.length);
  const bd = $derived(breakdownOf(session));
  const jumps = $derived([...steps].filter((x) => x.i > 0).sort((a, b) => b.delta - a.delta).slice(0, 5));
  const compactions = $derived(steps.filter((x) => x.compacted));

  // Start on the biggest jump: the most interesting step.
  let idx = $state(null);
  const current = $derived(idx ?? (jumps[0] ? jumps[0].i : 0));
  const step = $derived(steps[current]);
  const prev = $derived(current > 0 ? steps[current - 1] : null);
  const go = (i) => (idx = Math.max(0, Math.min(n - 1, i)));

  function onkey(e) {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') { go(current + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(current - 1); e.preventDefault(); }
  }
  const time = (iso) => (iso ? new Date(iso).toLocaleTimeString(ui.lang, { hour: '2-digit', minute: '2-digit' }) : '');
  const what = (it) => it.tool || t('row_' + it.cat);
  const restTokens = $derived(step ? Math.max(0, step.delta - step.top.reduce((a, it) => a + it.tokens, 0)) : 0);
</script>

<svelte:window onkeydown={onkey} />

{#if !n}
  <div class="card empty">{t('tl_none')}</div>
{:else}
  <div class="grid grid-2">
    <section class="card">
      <div class="card-head"><h2>{t('growth_title')}</h2><span class="card-sub">{t('tl_click')}</span></div>
      <GrowthChart points={session.timeline} limit={bd.win - bd.buffer} compactions={compactions.map((c) => c.i)} selected={current} onselect={go} />
      <div class="tl-jumps">
        <span class="card-sub">{t('tl_jumps')}</span>
        <div class="chips">
          {#each jumps as j (j.i)}<button type="button" class="chip-toggle" aria-pressed={current === j.i} onclick={() => go(j.i)}>#{j.i + 1} · +{fmtK(j.delta)}</button>{/each}
        </div>
        {#if compactions.length}
          <span class="card-sub">{t('tl_compactions')}</span>
          <div class="chips">
            {#each compactions as c (c.i)}<button type="button" class="chip-toggle" aria-pressed={current === c.i} onclick={() => go(c.i)}>#{c.i + 1} · {fmtK(c.delta)}</button>{/each}
          </div>
        {/if}
      </div>
    </section>

    <section class="card tl-step">
      <div class="card-head">
        <h2>{t('tt_request', { n: current + 1 })} <span class="card-sub">{t('tl_of', { n })} · {time(step.time)}</span></h2>
        <div class="tl-nav">
          <button class="icon-btn" type="button" aria-label={t('gd_prev')} disabled={current === 0} onclick={() => go(current - 1)}><Icon name="back" /></button>
          <button class="icon-btn" type="button" aria-label={t('gd_next')} disabled={current === n - 1} onclick={() => go(current + 1)}><Icon name="next" /></button>
        </div>
      </div>
      <input class="tl-slider" type="range" min="0" max={n - 1} value={current} oninput={(e) => go(+e.currentTarget.value)} aria-label={t('tl_slider')} />

      <div class="grid grid-2 tl-kpis">
        <div class="kpi"><span class="kpi-label">{t('tt_context')}</span><span class="kpi-value">{fmtK(step.total)}</span></div>
        <div class="kpi"><span class="kpi-label">{t('tl_change')}</span>
          <span class="kpi-value delta-big" class:up={step.delta > 0} class:down={step.delta < 0}>{step.delta > 0 ? '+' : ''}{fmtK(step.delta)}</span>
          {#if prev}<span class="kpi-note">{t('tl_from', { t: fmtK(prev.total) })}</span>{/if}</div>
      </div>

      {#if step.compacted}
        <div class="banner tl-compact"><Icon name="layers" /><span>{t('tl_compacted', { a: fmtK(prev ? prev.total : 0), b: fmtK(step.total) })}</span>
          <a href={link('/learn/compaction')}>{t('learn_more')} →</a></div>
      {/if}

      {#if step.prompt && !ui.privacy}
        <div class="tl-prompt"><span class="card-sub">{t('tl_prompt')}</span><p>{step.prompt}</p></div>
      {/if}

      <span class="card-sub">{t('tl_added', { n: step.count })}</span>
      <div class="items">
        {#each step.top as it, k (k)}
          <div class="item">
            <span class="sw" style:background={CAT_COLOR[it.cat] || 'var(--buffer)'}></span>
            <span class="t" title={maskText(it.label)}>{what(it)}<small>{maskText(it.label)}</small></span>
            <span class="v">{fmtK(it.tokens)}</span>
          </div>
        {:else}<div class="empty small">{t('tl_nothing')}</div>{/each}
      </div>
      {#if step.i > 0 && !step.compacted && restTokens > 500}<p class="small muted">{t('tl_rest', { t: fmtK(restTokens) })}</p>{/if}
      <p class="note"><Icon name="info" /><span>{t('tl_note')}</span></p>
    </section>
  </div>
{/if}
