<script>
  // Set budgets and see where you stand today and this week.
  import Icon from './Icon.svelte';
  import BudgetBar from './BudgetBar.svelte';
  import { ui, data, t, saveBudget } from '#lib/state.svelte.js';
  import { budgetReport } from '#lib/budget.js';

  const pricing = $derived(data.live?.pricing?.list);
  const report = $derived(budgetReport(data.sessions?.sessions, ui.budget, pricing));
  const isTokens = $derived(ui.budget.unit === 'tokens');
  // Token budgets are typed in millions, dollar budgets as-is.
  const shown = (v) => (v == null ? '' : isTokens ? v / 1e6 : v);
  function set(key, raw) {
    const n = parseFloat(String(raw).replace(',', '.'));
    saveBudget({ [key]: Number.isFinite(n) && n > 0 ? (isTokens ? n * 1e6 : n) : null });
  }
  async function toggleNotify(on) {
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
    saveBudget({ notify: on && typeof Notification !== 'undefined' && Notification.permission === 'granted' });
  }
  const notifyBlocked = $derived(typeof Notification !== 'undefined' && Notification.permission === 'denied');
</script>

<section class="card" id="budget">
  <div class="card-head"><h2>{t('bud_title')}</h2>
    <div class="seg" role="group" aria-label={t('bud_unit')}>
      <button type="button" aria-pressed={!isTokens} onclick={() => saveBudget({ unit: 'cost', daily: null, weekly: null, session: null })}>{t('bud_unit_cost')}</button>
      <button type="button" aria-pressed={isTokens} onclick={() => saveBudget({ unit: 'tokens', daily: null, weekly: null, session: null })}>{t('bud_unit_tokens')}</button>
    </div>
  </div>
  <p class="card-sub sub-lead">{t('bud_sub')}</p>
  <div class="grid grid-3 bud-inputs">
    {#each [['daily', 'bud_daily'], ['weekly', 'bud_weekly'], ['session', 'bud_session']] as [key, label] (key)}
      <label>{t(label)}
        <span class="input-unit">
          {#if !isTokens}<span>$</span>{/if}
          <input class="input" type="number" min="0" step="any" inputmode="decimal" placeholder={t('bud_none')} value={shown(ui.budget[key])} onchange={(e) => set(key, e.currentTarget.value)} />
          {#if isTokens}<span>{t('bud_million')}</span>{/if}
        </span>
      </label>
    {/each}
  </div>
  <div class="grid grid-2 bud-status">
    <BudgetBar label={t('bud_today')} st={report.today} />
    <BudgetBar label={t('bud_week')} st={report.week} />
  </div>
  {#if ui.budget.session}
    <p class="small {report.sessionsOver ? '' : 'muted'}">{report.sessionsOver ? t('bud_sessions_over', { n: report.sessionsOver }) : t('bud_sessions_ok')}</p>
  {/if}
  <label class="check-row">
    <input type="checkbox" checked={ui.budget.notify} disabled={notifyBlocked} onchange={(e) => toggleNotify(e.currentTarget.checked)} />
    <span>{t('bud_notify')}{#if notifyBlocked} <span class="muted small">({t('bud_notify_blocked')})</span>{/if}</span>
  </label>
  <p class="note"><Icon name="info" /><span>{t('bud_note')}</span></p>
</section>
