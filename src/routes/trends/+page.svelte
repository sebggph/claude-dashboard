<script>
  import Icon from '#lib/components/Icon.svelte';
  import Kpi from '#lib/components/Kpi.svelte';
  import DayChart from '#lib/components/DayChart.svelte';
  import DemoBanner from '#lib/components/DemoBanner.svelte';
  import BudgetCard from '#lib/components/BudgetCard.svelte';
  import { ui, data, t } from '#lib/state.svelte.js';
  import { fmtK, pct, maskProject } from '#lib/rules.js';
  import { costOf, fmtUSD } from '#lib/cost.js';
  import { daysOf } from '#lib/budget.js';

  let range = $state(30);
  const pricing = $derived(data.live?.pricing?.list);
  const sessions = $derived(data.sessions?.sessions || []);

  // Days in the range, oldest first (UTC dates, like the transcripts).
  const dayList = $derived.by(() => {
    const out = [];
    const today = new Date();
    for (let i = range - 1; i >= 0; i--) out.push(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i)).toISOString().slice(0, 10));
    return out;
  });

  const perDay = $derived.by(() => {
    const map = new Map(dayList.map((d) => [d, { day: d, requests: 0, tokens: 0, read: 0, inputAll: 0, buckets: [], sessions: new Set() }]));
    for (const s of sessions) {
      for (const [day, v] of daysOf(s)) {
        const d = map.get(day);
        if (!d) continue;
        d.requests += v.requests;
        d.tokens += v.input + v.cacheWrite + v.cacheRead + v.output;
        d.read += v.cacheRead;
        d.inputAll += v.input + v.cacheWrite + v.cacheRead;
        d.buckets.push(...Object.values(v.byModel || {}));
        d.sessions.add(s.id);
      }
    }
    return [...map.values()].map((d) => ({ ...d, cost: pricing ? costOf(d.buckets, pricing).usd : null }));
  });

  const totals = $derived.by(() => {
    const all = perDay.reduce((a, d) => { a.requests += d.requests; a.tokens += d.tokens; a.read += d.read; a.inputAll += d.inputAll; a.buckets.push(...d.buckets); d.sessions.forEach((x) => a.sessions.add(x)); return a; },
      { requests: 0, tokens: 0, read: 0, inputAll: 0, buckets: [], sessions: new Set() });
    return { ...all, cost: pricing ? costOf(all.buckets, pricing) : null };
  });

  const projects = $derived.by(() => {
    const m = new Map();
    for (const s of sessions) {
      const days = daysOf(s).filter(([d]) => dayList.includes(d));
      if (!days.length) continue;
      const key = s.project || '–';
      const p = m.get(key) || { project: key, requests: 0, buckets: [], sessions: 0 };
      p.sessions++;
      for (const [, v] of days) { p.requests += v.requests; p.buckets.push(...Object.values(v.byModel || {})); }
      m.set(key, p);
    }
    return [...m.values()].map((p) => ({ ...p, cost: pricing ? costOf(p.buckets, pricing).usd : null })).sort((a, b) => b.requests - a.requests).slice(0, 8);
  });
  const maxReq = $derived(Math.max(1, ...projects.map((p) => p.requests)));

  const usd = (v) => fmtUSD(v, ui.lang);
  const pctFmt = (v) => Math.round(v * 100) + '%';
</script>

<svelte:head><title>{t('tr_title')} · Context Dashboard</title></svelte:head>

<DemoBanner />
<div class="page-head">
  <div><h1>{t('tr_title')}</h1><p>{t('tr_sub')}</p></div>
  <div class="seg range" role="group" aria-label={t('tr_range')}>
    {#each [7, 30, 90] as r (r)}<button type="button" aria-pressed={range === r} onclick={() => (range = r)}>{t('tr_days', { n: r })}</button>{/each}
  </div>
</div>

<div class="stack">
  <div class="grid grid-4">
    <Kpi label={t('tr_active')} value={totals.sessions.size} note={t('tr_requests', { n: totals.requests.toLocaleString(ui.lang) })} />
    <Kpi label={t('kpi_tokens')} value={fmtK(totals.tokens)} note={t('tr_in_range')} />
    <Kpi label={t('kpi_cache')} value={pct(totals.inputAll ? totals.read / totals.inputAll : 0)} note={t('kpi_cache_note')} />
    <Kpi label={t('cost_est')} value={totals.cost ? usd(totals.cost.usd) : '–'} note={totals.cost ? t('tr_saved', { x: usd(totals.cost.saved) }) : t('cost_unavailable')} />
  </div>
  <div class="grid grid-2">
    <section class="card">
      <div class="card-head"><h2>{t('tr_req_day')}</h2></div>
      <DayChart days={perDay.map((d) => ({ day: d.day, value: d.requests }))} label={t('st_requests')} format={(v) => fmtK(v)} />
    </section>
    {#if ui.budget.unit === 'tokens'}
      <section class="card">
        <div class="card-head"><h2>{t('tr_tokens_day')}</h2></div>
        <DayChart days={perDay.map((d) => ({ day: d.day, value: d.tokens }))} label={t('kpi_tokens')} format={(v) => fmtK(v)} limit={ui.budget.daily} limitLabel={t('bud_daily')} />
      </section>
    {:else}
      <section class="card">
        <div class="card-head"><h2>{t('tr_cost_day')}</h2><span class="card-sub">{t('tr_api_prices')}</span></div>
        <DayChart days={perDay.map((d) => ({ day: d.day, value: d.cost }))} label={t('cost_est')} format={usd} limit={ui.budget.daily} limitLabel={t('bud_daily')} />
      </section>
    {/if}
  </div>
  <div class="grid grid-2">
    <section class="card">
      <div class="card-head"><h2>{t('tr_cache_day')}</h2><span class="card-sub">{t('tr_cache_hint')}</span></div>
      <DayChart kind="line" max={1} days={perDay.map((d) => ({ day: d.day, value: d.inputAll ? d.read / d.inputAll : null }))} label={t('kpi_cache')} format={pctFmt} />
    </section>
    <section class="card">
      <div class="card-head"><h2>{t('tr_projects')}</h2><span class="card-sub">{t('tr_projects_sub')}</span></div>
      <div class="hbars">
        {#each projects as p (p.project)}
          <div class="hbar static">
            <span class="name" title={maskProject(p.project)}>{maskProject(p.project)}</span>
            <span class="bar"><span style:width="{(p.requests / maxReq) * 100}%" style:background="var(--s1)"></span></span>
            <span class="val">{p.cost != null ? usd(p.cost) : fmtK(p.requests)}</span>
          </div>
        {:else}<div class="empty small">{t('tr_none')}</div>{/each}
      </div>
    </section>
  </div>
  <BudgetCard />
  <p class="note"><Icon name="info" /><span>{t('cost_note')}</span></p>
</div>
