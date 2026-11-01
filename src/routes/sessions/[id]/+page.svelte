<script>
  import Icon from '#lib/components/Icon.svelte';
  import Kpi from '#lib/components/Kpi.svelte';
  import RecCard from '#lib/components/RecCard.svelte';
  import ContextCard from '#lib/components/ContextCard.svelte';
  import GrowthChart from '#lib/components/GrowthChart.svelte';
  import DemoBanner from '#lib/components/DemoBanner.svelte';
  import { data as app, t } from '#lib/state.svelte.js';
  import { breakdownOf, recommendationsFor, CAT_COLOR, fmtK, pct, shortModel, projectName, ago } from '#lib/rules.js';

  let { data } = $props();
  const s = $derived(data.session);
  const bd = $derived(breakdownOf(s));
  const recs = $derived(recommendationsFor(s, app.sessions?.memoryFiles));
  const chips = $derived([projectName(s.project), s.gitBranch, shortModel(s.model), s.version && 'v' + s.version, ago(s.end)].filter(Boolean));
  const tok = $derived(s.totals);
  const toolName = (x) => (x.server ? x.name.split('__').slice(2).join('__') : x.name);
</script>

<svelte:head><title>{s.title || s.id} · Context Dashboard</title></svelte:head>

<DemoBanner />
<a href="/sessions" class="small"><Icon name="back" /> {t('back')}</a>
<div class="page-head" style="margin-top:10px">
  <div><h1>{s.title || s.id}</h1><div class="chips">{#each chips as c (c)}<span class="chip">{c}</span>{/each}</div></div>
</div>

<div class="stack">
  <div class="grid grid-2">
    <ContextCard session={s} />
    <div class="col-fill">
      <section class="card">
        <div class="card-head"><h2>{t('growth_title')}</h2><span class="card-sub">{t('growth_sub')}</span></div>
        <GrowthChart points={s.timeline} limit={bd.win - bd.buffer} compactions={(s.compactionEvents || []).map((c) => c.atRequest)} />
      </section>
      <div class="grid grid-2">
        <Kpi label={t('st_peak')} value={fmtK(s.peakTokens)} note={pct(s.peakTokens / bd.win)} />
        <Kpi label={t('st_cache')} value={pct(s.cacheHitRate)} note={t('kpi_cache_note')} />
      </div>
      <section class="card">
        <div class="card-head"><h2>{t('tok_title')}</h2></div>
        <p class="card-sub sub-lead">{t('tok_sub')}</p>
        <div class="legend-rows" style="margin-top:0">
          {#each [['tok_input', tok.input], ['tok_write', tok.cacheWrite], ['tok_read', tok.cacheRead], ['tok_output', tok.output]] as [k, v] (k)}
            <div class="lrow"><span></span><span>{t(k)}</span><span class="v">{fmtK(v)}</span><span class="p"></span></div>
          {/each}
          {#if tok.thinking}<div class="lrow sub"><span></span><span>{t('tok_thinking')}</span><span class="v">{fmtK(tok.thinking)}</span><span class="p"></span></div>{/if}
          <div class="lrow"><span></span><span>{t('st_requests')}</span><span class="v">{s.requests}</span><span class="p"></span></div>
        </div>
      </section>
    </div>
  </div>

  <section class="card">
    <div class="card-head"><h2>{t('recs_title')}</h2></div>
    <div class="recs grid grid-2">
      {#each recs as r (r.id)}<RecCard rec={r} />{:else}<div class="empty">{t('recs_none')}</div>{/each}
    </div>
  </section>

  <div class="grid grid-2">
    <section class="card">
      <div class="card-head"><h2>{t('biggest_title')}</h2></div>
      <p class="card-sub sub-lead">{t('biggest_sub')}</p>
      <div class="items">
        {#each s.biggest || [] as b, i (i)}
          <div class="item">
            <span class="sw" style:background={CAT_COLOR[b.cat] || 'var(--buffer)'}></span>
            <span class="t" title={b.label}>{b.tool || t('row_' + b.cat)}<small>{b.label}</small></span>
            <span class="v">{fmtK(b.tokens)}</span>
          </div>
        {/each}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>{t('tools_title')}</h2></div>
      <p class="card-sub sub-lead">{t('tools_sub')}</p>
      <div class="table-wrap"><table>
        <thead><tr><th>{t('col_tool')}</th><th class="r">{t('col_calls')}</th><th class="r">{t('col_ctx')}</th><th class="r">{t('col_errors')}</th></tr></thead>
        <tbody>
          {#each (s.tools || []).slice(0, 12) as x (x.name)}
            <tr>
              <td>{#if x.server}<span class="badge">MCP</span> {/if}<span class="mono small">{toolName(x)}</span>{#if x.server}<div class="cell-sub">{x.server}</div>{/if}</td>
              <td class="r num">{x.calls}</td><td class="r num">{fmtK(x.callTokens + x.resultTokens)}</td><td class="r num">{x.errors || '–'}</td>
            </tr>
          {/each}
        </tbody>
      </table></div>
    </section>
  </div>

  <section class="card">
    <div class="card-head"><h2>{t('sub_title')}</h2></div>
    <p class="card-sub sub-lead">{t('sub_sub')}</p>
    {#if s.subagents?.length}
      <div class="table-wrap"><table>
        <thead><tr><th>{t('col_agent')}</th><th class="r">{t('col_tools')}</th><th class="r">{t('col_peak')}</th></tr></thead>
        <tbody>
          {#each s.subagents as a (a.id)}
            <tr><td><div class="cell-title">{a.description || a.id}</div><div class="cell-sub">{a.type}</div></td>
              <td class="r num">{a.toolCalls}</td><td class="r num">{fmtK(a.peak)}</td></tr>
          {/each}
        </tbody>
      </table></div>
    {:else}<div class="empty small">{t('sub_none')}</div>{/if}
  </section>
</div>
