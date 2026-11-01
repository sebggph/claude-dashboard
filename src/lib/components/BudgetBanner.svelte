<script>
  // Warning at the top of Home / Dashboard when a budget is close or over.
  import Icon from './Icon.svelte';
  import { ui, data, t } from '#lib/state.svelte.js';
  import { budgetReport } from '#lib/budget.js';
  import { fmtK } from '#lib/rules.js';
  import { fmtUSD } from '#lib/cost.js';

  const report = $derived(budgetReport(data.sessions?.sessions, ui.budget, data.live?.pricing?.list));
  const fmt = (v) => (ui.budget.unit === 'tokens' ? fmtK(v) : fmtUSD(v, ui.lang));
  const items = $derived([
    ['today', report.today], ['week', report.week],
  ].filter(([, st]) => st.level === 'near' || st.level === 'over'));
  const worst = $derived(items.some(([, st]) => st.level === 'over') ? 'over' : 'near');
</script>

{#if items.length || report.sessionsOver}
  <div class="banner budget-banner {worst}" role="status">
    <Icon name="alert" />
    <span>
      {#each items as [scope, st], i (scope)}{i ? ' · ' : ''}<b>{t('bud_banner_' + scope)}</b> {fmt(st.value)} / {fmt(st.limit)} ({Math.round(st.pct * 100)}%){/each}
      {#if report.sessionsOver}{items.length ? ' · ' : ''}{t('bud_sessions_over', { n: report.sessionsOver })}{/if}
    </span>
    <a href="/trends#budget">{t('bud_manage')} →</a>
  </div>
{/if}
