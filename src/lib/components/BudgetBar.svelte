<script>
  // Progress toward one budget, with status color + icon + words (never color alone).
  import Icon from './Icon.svelte';
  import { ui, t } from '#lib/state.svelte.js';
  import { fmtK } from '#lib/rules.js';
  import { fmtUSD } from '#lib/cost.js';
  let { label, st } = $props();
  const fmt = (v) => (v == null ? '–' : ui.budget.unit === 'tokens' ? fmtK(v) : fmtUSD(v, ui.lang));
  const color = $derived({ ok: 'var(--good)', near: 'var(--warning)', over: 'var(--critical)' }[st.level] || 'var(--text-3)');
</script>

<div class="budget-bar">
  <div class="bb-head">
    <span>{label}</span>
    {#if st.level === 'none'}<span class="muted small">{t('bud_off')}</span>
    {:else}<span class="bb-val"><b>{fmt(st.value)}</b> / {fmt(st.limit)}</span>{/if}
  </div>
  {#if st.level !== 'none'}
    <span class="track"><span style:width="{Math.min(100, st.pct * 100)}%" style:background={color}></span></span>
    <span class="status small" style:color={st.level === 'ok' ? 'var(--text-2)' : color}>
      <Icon name={st.level === 'ok' ? 'check' : 'alert'} small /> {t('bud_' + st.level, { p: Math.round(st.pct * 100) + '%' })}
    </span>
  {/if}
</div>
