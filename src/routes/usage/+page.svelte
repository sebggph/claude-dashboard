<script>
  import Icon from '#lib/components/Icon.svelte';
  import Kpi from '#lib/components/Kpi.svelte';
  import DayChart from '#lib/components/DayChart.svelte';
  import DemoBanner from '#lib/components/DemoBanner.svelte';
  import Loading from '#lib/components/Loading.svelte';
  import FixPanel from '#lib/components/FixPanel.svelte';
  import { ui, data, load, t } from '#lib/state.svelte.js';
  import { fmtK, pct, maskProject, sessionTitle, shortModel, LEVEL } from '#lib/rules.js';
  import { fmtUSD } from '#lib/cost.js';
  import { link } from '#lib/paths.js';
  import { weekDays, summarize, findingsFor } from '#lib/usage.js';

  let back = $state(2); // compare with 1 or 2 weeks ago
  let error = $state(null);
  $effect(() => { load.usage().catch((e) => (error = e.message)); });

  const pricing = $derived(data.live?.pricing?.list || null);
  const usage = $derived(data.usage);
  // Demo data is fixed in time: count back from its latest day instead of today.
  const today = $derived(usage?.demo && usage.sessions.length ? new Date(usage.sessions.map((s) => s.end).sort().at(-1)) : new Date());
  const weeks = $derived(usage ? [0, 1, 2].map((k) => summarize(usage, weekDays(today, k), pricing)) : null);
  const cur = $derived(weeks?.[0]);
  const prev = $derived(weeks?.[back]);
  const findings = $derived(cur ? findingsFor(cur, prev) : []);
  const costRatio = $derived(cur ? (pricing ? ratio(cur.usd, prev.usd) : ratio(cur.tokens, prev.tokens)) : null);

  // Cost per day for the last 3 weeks.
  const perDay = $derived.by(() => {
    if (!usage) return [];
    const days = [...weekDays(today, 2), ...weekDays(today, 1), ...weekDays(today, 0)];
    return days.map((d) => { const s = summarize(usage, [d], pricing); return { day: d, value: pricing ? s.usd : s.tokens }; });
  });

  // Costs need prices; without them fall back to tokens.
  const val = (usd, tokens) => (pricing ? fmtUSD(usd, ui.lang) : fmtK(tokens));
  const usd = (v) => fmtUSD(v, ui.lang);
  const ratio = (a, b) => (b > 0 ? a / b : null);
  const times = (x) => (x >= 10 ? Math.round(x) : x.toFixed(1));
  const weekLabel = (k) => t(k === 1 ? 'us_vs_1' : 'us_vs_2');
  const agentName = (f, i) => (ui.privacy ? t('us_priv_agent', { n: i + 1 }) : f.name);
  const KIND_COLOR = { main: 'var(--s1)', subagent: 'var(--s2)', workflow: 'var(--s3)' };
  const maxSession = $derived(Math.max(1e-9, ...(cur?.sessions || []).slice(0, 6).map((s) => s.usd || s.tokens)));
  const maxFamily = $derived(Math.max(1e-9, ...(cur?.families || []).slice(0, 6).map((f) => f.usd)));

  const DOCS = {
    growth: 'https://code.claude.com/docs/en/costs',
    memory_loads: 'https://code.claude.com/docs/en/sub-agents',
    idle_rebuilds: 'https://code.claude.com/docs/en/prompt-caching#cache-lifetime',
    agents_share: 'https://code.claude.com/docs/en/sub-agents',
    one_model: 'https://code.claude.com/docs/en/sub-agents',
    workflows: 'https://code.claude.com/docs/en/workflows',
    big_context: 'https://code.claude.com/docs/en/context-window',
  };

  // Numbers in texts: money, shares, model names, kinds.
  function vars(f) {
    const v = f.vars;
    return {
      ...v,
      usd: usd(v.usd), before: v.before != null ? usd(v.before) : '', share: v.share != null ? pct(v.share) : '',
      x: v.x != null ? times(v.x) : '', model: v.model ? shortModel(v.model) : '', kind: v.kind ? t('us_kind_' + v.kind).toLowerCase() : '',
      n: v.n != null ? v.n.toLocaleString(ui.lang) : '',
    };
  }

  function promptFor(f) {
    const v = vars(f);
    const lines = [t('fx_intro', { usd: usd(cur.usd) }), '', t('fx_' + f.id, v)];
    if (f.evidence.length) {
      lines.push('', t('fx_evidence'));
      for (const e of f.evidence) lines.push(t('fx_evidence_line', { name: e.name, n: e.count, usd: usd(e.usd), p: fmtK(e.peak) }));
    }
    lines.push('', t('fx_end'));
    return lines.join('\n');
  }
</script>

<svelte:head><title>{t('us_title')} · Context Dashboard</title></svelte:head>

<DemoBanner />
<div class="page-head">
  <div><h1>{t('us_title')}</h1><p>{t('us_sub')}</p></div>
  <div class="seg range" role="group" aria-label={t('us_vs')}>
    {#each [1, 2] as k (k)}<button type="button" aria-pressed={back === k} onclick={() => (back = k)}>{weekLabel(k)}</button>{/each}
  </div>
</div>

{#if !usage}
  {#if error}<Loading {error} />{:else}<div class="card empty"><p>{t('us_loading')}</p></div>{/if}
{:else if !cur.requests && !prev.requests}
  <div class="card empty"><p>{t('us_none')}</p></div>
{:else}
  <div class="stack">
    <div class="grid grid-4">
      <Kpi label={t('us_kpi_cost')} value={val(cur.usd, cur.tokens)}
        note={costRatio != null ? t('us_kpi_cost_note', { x: times(costRatio), w: weekLabel(back) }) : t('us_kpi_cost_new')} />
      <Kpi label={t('us_kpi_req')} value={cur.requests.toLocaleString(ui.lang)} note={t('us_before', { x: prev.requests.toLocaleString(ui.lang) })} />
      <Kpi label={t('us_kpi_agents')} value={cur.agents.toLocaleString(ui.lang)} note={t('us_kpi_agents_note', { n: cur.workflows })} />
      <Kpi label={t('us_kpi_share')} value={pct(cur.agentShare)} note={t('us_before', { x: pct(prev.agentShare) })} />
    </div>

    <section class="card">
      <div class="card-head"><h2>{t('us_findings')}</h2><span class="card-sub">{t('us_findings_sub')}</span></div>
      <div class="recs">
        {#each findings as f (f.id)}
          <div class="rec">
            <div class="rec-icon" style:color={LEVEL[f.level].color}><Icon name={LEVEL[f.level].icon} /></div>
            <div>
              <h3>{t('f_' + f.id + '_t', vars(f))}{#if f.project}<span class="muted small">&nbsp;· {maskProject(f.project)}</span>{/if}</h3>
              <p>{t('f_' + f.id, vars(f))}</p>
              <div class="rec-links">
                <a href={DOCS[f.id]} target="_blank" rel="noopener noreferrer">{t('official_docs')} ↗</a>
              </div>
              {#if f.id !== 'growth'}<FixPanel prompt={promptFor(f)} project={f.project} />{/if}
            </div>
          </div>
        {:else}<div class="empty small">{t('us_findings_none')}</div>{/each}
      </div>
    </section>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h2>{t('us_where')}</h2><span class="card-sub">{t('us_where_sub')}</span></div>
        <div class="hbars tall">
          {#each ['main', 'subagent', 'workflow'] as k (k)}
            {@const c = cur.kinds[k]}
            <div class="hbar static">
              <span class="name">{t('us_kind_' + k)}<br /><span class="muted small">{t('us_before', { x: val(prev.kinds[k].usd, prev.kinds[k].tokens) })}</span></span>
              <span class="bar"><span style:width="{(pricing ? c.usd / (cur.usd || 1) : c.tokens / (cur.tokens || 1)) * 100}%" style:background={KIND_COLOR[k]}></span></span>
              <span class="val">{val(c.usd, c.tokens)}</span>
            </div>
          {/each}
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>{t('us_models')}</h2><span class="card-sub">{t('us_models_sub')}</span></div>
        <div class="hbars tall">
          {#each cur.models.slice(0, 3) as m, i (m.model)}
            <div class="hbar static">
              <span class="name">{shortModel(m.model)}</span>
              <span class="bar"><span style:width="{(pricing ? m.usd / (cur.usd || 1) : m.tokens / (cur.tokens || 1)) * 100}%" style:background="var(--s{i + 1})"></span></span>
              <span class="val">{pct(pricing ? m.usd / (cur.usd || 1) : m.tokens / (cur.tokens || 1))}</span>
            </div>
          {:else}<div class="empty small">{t('tr_none')}</div>{/each}
        </div>
      </section>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h2>{t('us_sessions')}</h2><span class="card-sub">{t('us_sessions_sub')}</span></div>
        <div class="hbars tall">
          {#each cur.sessions.slice(0, 6) as s (s.id)}
            <a class="hbar" href={link(`/sessions/${encodeURIComponent(s.id)}`)}>
              <span class="name" title={sessionTitle(s)}>{sessionTitle(s)}<br /><span class="muted small">{maskProject(s.project)} · {t('us_session_agents', { n: s.agents, x: val(s.agentUsd, 0) })}</span></span>
              <span class="bar"><span style:width="{((s.usd - s.agentUsd) / maxSession) * 100}%" style:background={KIND_COLOR.main}></span><span style:width="{(s.agentUsd / maxSession) * 100}%" style:background={KIND_COLOR.subagent}></span></span>
              <span class="val">{val(s.usd, s.tokens)}</span>
            </a>
          {:else}<div class="empty small">{t('tr_none')}</div>{/each}
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>{t('us_agents')}</h2><span class="card-sub">{t('us_agents_sub')}</span></div>
        <div class="hbars tall">
          {#each cur.families.slice(0, 6) as f, i (f.name)}
            <div class="hbar static">
              <span class="name" title={agentName(f, i)}>{agentName(f, i)}<br /><span class="muted small">{t('us_agents_n', { n: f.count, p: fmtK(f.peak) })}</span></span>
              <span class="bar"><span style:width="{(f.usd / maxFamily) * 100}%" style:background={KIND_COLOR[f.kind]}></span></span>
              <span class="val">{val(f.usd, 0)}</span>
            </div>
          {:else}<div class="empty small">{t('tr_none')}</div>{/each}
        </div>
      </section>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h2>{t('us_day')}</h2><span class="card-sub">{t('us_day_sub')}</span></div>
        <DayChart days={perDay} label={t('us_kpi_cost')} format={(v) => (pricing ? usd(v) : fmtK(v))} />
      </section>
      <section class="card">
        <div class="card-head"><h2>{t('us_weeks')}</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>{t('us_week_col')}</th><th>{t('us_kpi_cost')}</th><th>{t('us_kpi_req')}</th><th>{t('us_agents_col')}</th><th>{t('us_share_col')}</th></tr></thead>
            <tbody>
              {#each weeks as w, k (k)}
                <tr>
                  <td class="nowrap">{k === 0 ? t('us_this') : weekLabel(k)}<br /><span class="muted small nowrap">{w.days[0].slice(5)} – {w.days[6].slice(5)}</span></td>
                  <td>{val(w.usd, w.tokens)}</td>
                  <td>{w.requests.toLocaleString(ui.lang)}</td>
                  <td>{w.agents.toLocaleString(ui.lang)}</td>
                  <td>{pct(w.agentShare)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <p class="note"><Icon name="info" /><span>{t('us_note')} <a href="https://code.claude.com/docs/en/costs" target="_blank" rel="noopener noreferrer">{t('official_docs')} ↗</a></span></p>
  </div>
{/if}
