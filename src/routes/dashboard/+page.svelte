<script>
  import Icon from '#lib/components/Icon.svelte';
  import Kpi from '#lib/components/Kpi.svelte';
  import Explain from '#lib/components/Explain.svelte';
  import RecCard from '#lib/components/RecCard.svelte';
  import GuideCard from '#lib/components/GuideCard.svelte';
  import DemoBanner from '#lib/components/DemoBanner.svelte';
  import { ui, data, t, progress } from '#lib/state.svelte.js';
  import { breakdownOf, windowFor, recommendationsFor, GROUPS, GUIDE_KEY, pct, pctSmart, fmtK, slugOf, sessionTitle } from '#lib/rules.js';

  const sessions = $derived(data.sessions?.sessions || []);
  const active = $derived(sessions.filter((s) => s.end && Date.now() - new Date(s.end) < 86400000).length);
  const avgUsed = $derived(sessions.length ? sessions.reduce((a, s) => a + s.contextTokens / windowFor(s), 0) / sessions.length : 0);
  const tot = $derived(sessions.reduce((a, s) => {
    a.in += s.totals.input + s.totals.cacheWrite + s.totals.cacheRead; a.read += s.totals.cacheRead; a.out += s.totals.output; return a;
  }, { in: 0, read: 0, out: 0 }));
  const fullest = $derived([...sessions].sort((a, b) => b.contextTokens / windowFor(b) - a.contextTokens / windowFor(a)).slice(0, 7).map((s) => ({ s, bd: breakdownOf(s) })));

  const mix = $derived.by(() => {
    const m = {};
    for (const s of sessions) for (const g of breakdownOf(s).groups) m[g.id] = (m[g.id] || 0) + g.tokens;
    return m;
  });
  const mixTotal = $derived(Object.values(mix).reduce((a, v) => a + v, 0) || 1);
  const mixGroups = $derived(GROUPS.filter((g) => mix[g.id]));

  const topRecs = $derived.by(() => {
    const order = { serious: 0, warning: 1, info: 2 };
    const all = [];
    for (const s of sessions.slice(0, 30)) for (const r of recommendationsFor(s, data.sessions.memoryFiles)) all.push({ ...r, session: sessionTitle(s) });
    const seen = new Set();
    return all.sort((a, b) => order[a.level] - order[b.level]).filter((r) => (seen.has(r.id) ? false : seen.add(r.id))).slice(0, 4);
  });

  const guides = $derived.by(() => {
    const all = data.docsIndex[ui.lang] || [];
    const pick = [...all.filter((g) => g.section === 'start'), ...all.filter((g) => !progress.isRead(slugOf(g.file))), ...all];
    return pick.filter((g, i) => pick.indexOf(g) === i).slice(0, 4);
  });
</script>

<DemoBanner />
<div class="page-head"><div><h1>{t('ov_title')}</h1><p>{t('ov_sub')}</p></div></div>
<div class="stack">
  <div class="grid grid-4">
    <Kpi label={t('kpi_sessions')} value={sessions.length} note={t('kpi_sessions_note', { n: active })} />
    <Kpi label={t('kpi_avg')} value={pct(avgUsed)} note={t('kpi_avg_note')} />
    <Kpi label={t('kpi_cache')} value={pct(tot.in ? tot.read / tot.in : 0)} note={t('kpi_cache_note')} />
    <Kpi label={t('kpi_tokens')} value={fmtK(tot.in + tot.out)} note={t('kpi_tokens_note')} />
  </div>
  <div class="grid grid-2">
    <section class="card">
      <div class="card-head"><h2>{t('ov_fullest')}</h2><a class="small" href="/sessions">{t('see_all')} →</a></div>
      <div class="hbars">
        {#each fullest as { s, bd } (s.id)}
          <a class="hbar" href="/sessions/{s.id}">
            <span class="name" title={sessionTitle(s)}>{sessionTitle(s)}</span>
            <span class="bar">{#each bd.groups as g (g.id)}<span style:width="{(g.tokens / bd.win) * 100}%" style:background={g.color}></span>{/each}</span>
            <span class="val">{pctSmart(bd.used / bd.win)}</span>
          </a>
        {:else}<div class="empty">–</div>{/each}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>{t('ov_mix')}</h2><span class="card-sub">{t('ov_mix_sub')}</span></div>
      <div class="stackbar" style="height:16px">
        {#each mixGroups as g (g.id)}<span style:width="{(mix[g.id] / mixTotal) * 100}%" style:background={g.color}></span>{/each}
      </div>
      <div class="legend-rows">
        {#each mixGroups as g (g.id)}
          <div class="lrow"><span class="sw" style:background={g.color}></span>
            <Explain key={GUIDE_KEY[g.rows[0]]} label={t('grp_' + g.id)} />
            <span class="v">{fmtK(mix[g.id])}</span><span class="p">{pctSmart(mix[g.id] / mixTotal)}</span></div>
        {/each}
      </div>
    </section>
  </div>
  <div class="grid grid-2">
    <section class="card">
      <div class="card-head"><h2>{t('ov_recs')}</h2><span class="card-sub">{t('ov_recs_sub')}</span></div>
      <div class="recs">
        {#each topRecs as r (r.id)}<RecCard rec={r} session={r.session} />
        {:else}<div class="empty"><Icon name="check" /> {t('recs_none')}</div>{/each}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>{t('ov_learn')}</h2><a class="small" href="/learn">{t('see_all')} →</a></div>
      <div class="grid grid-2">{#each guides as g (g.file)}<GuideCard guide={g} />{/each}</div>
    </section>
  </div>
</div>
