<script>
  // Change from A to B, with an arrow and a word (never color alone).
  import { t } from '#lib/state.svelte.js';
  let { d, pct = true } = $props();
  const arrow = $derived(d.diff == null || d.diff === 0 ? '·' : d.diff > 0 ? '▲' : '▼');
  const pctText = $derived(d.rel == null || !Number.isFinite(d.rel) ? '' : `${d.rel > 0 ? '+' : ''}${Math.round(d.rel * 100)}%`);
</script>

<span class="delta {d.verdict}" title={t('cmp_' + d.verdict)}>
  {arrow} {pct ? pctText : ''}{#if d.verdict !== 'same'}<span class="sr-only"> {t('cmp_' + d.verdict)}</span>{/if}
</span>
