<script>
  // Your week: the plan's weekly % (from the status line log, or typed in),
  // and when you'd reach 100% at the pace of the last 24 hours.
  import Icon from './Icon.svelte';
  import { ui, t, store } from '#lib/state.svelte.js';
  import { ago, pct } from '#lib/rules.js';
  import { fmtUSD } from '#lib/cost.js';
  import { planReading, planForecast } from '#lib/usage.js';

  let { usage, pricing } = $props();

  const readManual = () => { try { return JSON.parse(store.get('plan', 'null')); } catch { return null; } };
  let manual = $state(readManual());
  let now = $state(Date.now());
  $effect(() => { const id = setInterval(() => (now = Date.now()), 60000); return () => clearInterval(id); });

  const reading = $derived(planReading(usage?.plan, manual, now));
  const f = $derived(planForecast(usage, reading, pricing, now));
  let editing = $state(false);
  const showForm = $derived(editing || !reading);

  // Form: weekly % and reset time as shown by /usage in Claude Code.
  const toLocal = (ms) => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  let formPct = $state('');
  let formReset = $state('');
  $effect(() => {
    if (!showForm) return;
    if (formPct === '' && reading) formPct = String(Math.round(reading.pct));
    if (!formReset) formReset = toLocal(reading ? reading.resetsAt : Date.now() + 3 * 86400000);
  });
  function save() {
    const p = Number(formPct);
    if (!(p >= 0 && p <= 100) || !formReset) return;
    manual = { pct: p, at: new Date().toISOString(), resetsAt: new Date(formReset).toISOString() };
    store.set('plan', JSON.stringify(manual));
    editing = false;
  }

  const when = (ms) => new Date(ms).toLocaleString(ui.lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const level = $derived(!f ? '' : f.pct >= 80 || f.hitAt ? 'bad' : f.pct >= 60 ? 'warn' : 'ok');
  let copied = $state(false);
  const cmd = $derived(`node "${usage?.planScript || 'scripts/statusline-plan-log.mjs'}" | `);
  async function copy() { try { await navigator.clipboard.writeText(cmd); copied = true; setTimeout(() => (copied = false), 1500); } catch { /* blocked */ } }
</script>

<section class="card plan">
  <div class="card-head"><h2>{t('pl_title')}</h2>
    {#if reading && !editing}<button class="link-btn small" type="button" onclick={() => (editing = true)}>{t('pl_update')}</button>{/if}</div>
  {#if f && !showForm}
    <div class="plan-top">
      <span class="kpi-value">{f.perPct ? '≈' : ''}{Math.round(f.pct)}%</span>
      <span class="small muted">{t('pl_of_week')}</span>
    </div>
    <div class="plan-bar {level}" role="img" aria-label={t('pl_bar', { now: Math.round(f.pct), end: Math.round(f.atReset ?? f.pct) })}>
      <span class="now" style:width="{f.pct}%"></span>
      {#if f.atReset != null}<span class="ahead" style:left="{f.pct}%" style:width="{Math.max(0, f.atReset - f.pct)}%"></span>{/if}
    </div>
    <p class="small plan-line">
      {#if f.hitAt}<b class="bad">{t('pl_hit', { when: when(f.hitAt) })}</b>
      {:else if f.atReset != null}{t('pl_ok', { p: Math.round(f.atReset) })}
      {:else}{t('pl_no_pace')}{/if}
    </p>
    <p class="small muted plan-line">
      {t('pl_resets', { when: when(f.resetsAt) })} ·
      {reading.source === 'statusline' ? t('pl_from_status', { ago: ago(reading.at) }) : t('pl_from_manual', { ago: ago(reading.at) })}
      {#if f.perPct} · {t('pl_per_pct', { x: fmtUSD(f.perPct, ui.lang) })}{/if}
    </p>
    {#if reading.stale}<p class="small muted">{t('pl_stale')}</p>{/if}
  {:else}
    <p class="small">{t('pl_intro')}</p>
    <form class="plan-form" onsubmit={(e) => { e.preventDefault(); save(); }}>
      <label>{t('pl_pct')}<input type="number" min="0" max="100" step="1" bind:value={formPct} required /></label>
      <label>{t('pl_reset')}<input type="datetime-local" bind:value={formReset} required /></label>
      <div class="fix-actions">
        <button class="btn primary" type="submit">{t('pl_save')}</button>
        {#if reading}<button class="btn" type="button" onclick={() => (editing = false)}>{t('fix_hide')}</button>{/if}
      </div>
    </form>
  {/if}
  {#if reading?.source !== 'statusline'}
    <details class="plan-connect">
      <summary class="small">{t('pl_connect')}</summary>
      <p class="small">{t('pl_connect_text')}</p>
      {#if !ui.privacy}<pre class="fix-cmd">{cmd}{t('pl_connect_yours')}</pre>{/if}
      <div class="fix-actions">
        <button class="btn" type="button" onclick={copy}><Icon name="terminal" />{copied ? t('fix_copied') : t('pl_copy')}</button>
        <a class="small" href="https://code.claude.com/docs/en/statusline" target="_blank" rel="noopener noreferrer">{t('official_docs')} ↗</a>
      </div>
    </details>
  {/if}
</section>
