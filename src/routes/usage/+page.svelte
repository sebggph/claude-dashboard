<script>
  import Icon from '#lib/components/Icon.svelte';
  import Kpi from '#lib/components/Kpi.svelte';
  import DayChart from '#lib/components/DayChart.svelte';
  import DemoBanner from '#lib/components/DemoBanner.svelte';
  import Loading from '#lib/components/Loading.svelte';
  import FixPanel from '#lib/components/FixPanel.svelte';
  import PlanCard from '#lib/components/PlanCard.svelte';
  import { ui, data, load, t, store } from '#lib/state.svelte.js';
  import { fmtK, pct, maskProject, sessionTitle, shortModel, LEVEL, ago } from '#lib/rules.js';
  import { fmtUSD } from '#lib/cost.js';
  import { link } from '#lib/paths.js';
  import { weekDays, summarize, findingsFor, fixesIn, markedFixes, latestFix, checkFix, workflowRuns, planReading, planForecast, fixTagFor, MIN_REQUESTS, MIN_AGENTS } from '#lib/usage.js';

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
  // Fix sessions found in the transcripts, and how each one is doing.
  // Plus fixes marked by hand (made another way), kept in this browser.
  const readMarks = () => { try { return JSON.parse(store.get('fixmarks', '{}')) || {}; } catch { return {}; } };
  let marks = $state(readMarks());
  function setMark(f, on) {
    const k = f.id + '|' + f.project;
    const next = { ...marks };
    if (on) next[k] = new Date().toISOString(); else delete next[k];
    marks = next;
    store.set('fixmarks', JSON.stringify(next));
  }
  const fixes = $derived(usage ? [...fixesIn(usage), ...markedFixes(marks)] : []);
  const checks = $derived.by(() => {
    const m = new Map();
    for (const f of fixes) {
      const k = f.id + '|' + f.project;
      const latest = latestFix(fixes, f.id, f.project);
      if (!m.has(k)) m.set(k, { fix: latest, check: checkFix(usage, latest, pricing) });
    }
    return m;
  });
  const checkOf = (f) => checks.get(f.id + '|' + f.project) || null;
  // Findings that look fixed go last: they stay until older days leave the 7-day window.
  const runs = $derived(usage ? workflowRuns(usage, weekDays(today, 0), pricing) : []);
  const maxRun = $derived(Math.max(1e-9, ...runs.slice(0, 6).map((w) => w.usd || w.tokens)));
  const when = (iso) => new Date(iso).toLocaleString(ui.lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // A plain-text summary of the week to paste in a note or chat.
  let reported = $state(false);
  async function copyReport() {
    const L = [`# ${t('us_title')} · ${cur.days[0]} – ${cur.days[6]}`, ''];
    L.push(`- ${t('us_kpi_cost')}: ${val(cur.usd, cur.tokens)} (${weekLabel(back)}: ${val(prev.usd, prev.tokens)})`);
    L.push(`- ${t('us_kpi_req')}: ${cur.requests.toLocaleString(ui.lang)} · ${t('us_kpi_agents')}: ${cur.agents} · ${t('us_kpi_share')}: ${pct(cur.agentShare)}`);
    let manualPlan = null; try { manualPlan = JSON.parse(store.get('plan', 'null')); } catch { /* none */ }
    const fc = planForecast(usage, planReading(usage.plan, manualPlan), pricing);
    if (fc) L.push(`- ${t('pl_title')}: ≈${Math.round(fc.pct)}% · ${fc.hitAt ? t('pl_hit', { when: when(fc.hitAt) }) : fc.atReset != null ? t('pl_ok', { p: Math.round(fc.atReset) }) : ''}`);
    L.push('', `## ${t('us_where')}`);
    for (const k of ['main', 'subagent', 'workflow']) L.push(`- ${t('us_kind_' + k)}: ${val(cur.kinds[k].usd, cur.kinds[k].tokens)}`);
    L.push('', `## ${t('us_findings')}`);
    for (const f of findings) L.push(`- ${t('f_' + f.id + '_t', vars(f))}${f.project ? ` (${maskProject(f.project)})` : ''}: ${t('f_' + f.id, vars(f))}${checkOf(f) ? ` [${t('fs_' + checkOf(f).check.status + '_t')}]` : ''}`);
    L.push('', `## ${t('us_agents')}`);
    cur.families.slice(0, 5).forEach((f, i) => L.push(`- ${agentName(f, i)}: ${f.count}× · ${val(f.usd, 0)}`));
    L.push('', `## ${t('us_sessions')}`);
    for (const s of cur.sessions.slice(0, 5)) L.push(`- ${sessionTitle(s)} (${maskProject(s.project)}): ${val(s.usd, s.tokens)}`);
    try { await navigator.clipboard.writeText(L.join('\n')); reported = true; setTimeout(() => (reported = false), 1500); } catch { /* blocked */ }
  }

  const findings = $derived.by(() => {
    if (!cur) return [];
    const list = findingsFor(cur, prev);
    const done = (f) => checkOf(f)?.check.status === 'fixed';
    return [...list.filter((f) => !done(f)), ...list.filter(done)];
  });
  // Fix sessions whose finding no longer shows up: proof that it worked.
  const pastFixes = $derived([...checks.values()].filter((c) => !findings.some((f) => f.id === c.fix.id && f.project === c.fix.project)));
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
    const lines = [fixTagFor(f.id) + ' ' + t('fx_intro', { usd: usd(cur.usd) }), '', t('fx_' + f.id, v)];
    if (f.evidence.length) {
      lines.push('', t('fx_evidence'));
      for (const e of f.evidence) lines.push(t('fx_evidence_line', { name: e.name, n: e.count, usd: usd(e.usd), p: fmtK(e.peak) }));
    }
    lines.push('', t('fx_end'));
    return lines.join('\n');
  }
</script>

{#snippet status(c)}
  {@const k = c.check}
  <div class="fix-status {k.status}">
    <p class="small">
      {#if c.fix.manual}
        {t('fs_marked', { ago: ago(c.fix.start) })}
        <button class="link-btn" type="button" onclick={() => setMark(c.fix, false)}>{t('fs_undo')}</button>
      {:else}
        {t('fs_ran', { ago: ago(c.fix.start) })}
        <a href={link(`/sessions/${encodeURIComponent(c.fix.session)}`)}>{sessionTitle({ id: c.fix.session, title: c.fix.title })}</a>
      {/if}
    </p>
    <p class="small"><b>{t('fs_' + k.status + '_t')}</b>
      {#if k.status === 'waiting'}
        {k.needAgents && k.requests >= MIN_REQUESTS ? t('fs_waiting_agents', { n: k.agents, min: MIN_AGENTS }) : t('fs_waiting', { n: k.requests, min: MIN_REQUESTS })}
      {:else}
        {t('fs_compare', { before: pct(k.before), after: pct(k.after), limit: pct(k.limit) })}
      {/if}
    </p>
    <p class="small muted">{t('fs_how')}</p>
  </div>
{/snippet}

<svelte:head><title>{t('us_title')} · Context Dashboard</title></svelte:head>

<DemoBanner />
<div class="page-head">
  <div><h1>{t('us_title')}</h1><p>{t('us_sub')}</p></div>
  <div class="head-tools">
    {#if cur}<button class="btn" type="button" onclick={copyReport}><Icon name="sheet" />{reported ? t('rep_copied') : t('rep_copy')}</button>{/if}
    <div class="seg range" role="group" aria-label={t('us_vs')}>
      {#each [1, 2] as k (k)}<button type="button" aria-pressed={back === k} onclick={() => (back = k)}>{weekLabel(k)}</button>{/each}
    </div>
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

    <div class="grid grid-2">
      <PlanCard {usage} {pricing} />
      <section class="card">
        <div class="card-head"><h2>{t('wr_title')}</h2><span class="card-sub">{t('wr_sub')}</span></div>
        <div class="hbars tall">
          {#each runs.slice(0, 6) as w (w.session + w.id)}
            <a class="hbar" href={link(`/sessions/${encodeURIComponent(w.session)}`)}>
              <span class="name" title={ui.privacy ? '' : w.top.join(', ')}>{sessionTitle({ id: w.session, title: w.title })}<br /><span class="muted small">{t('wr_agents', { n: w.agents, when: when(w.start) })}</span></span>
              <span class="bar"><span style:width="{((w.usd || w.tokens) / maxRun) * 100}%" style:background={KIND_COLOR.workflow}></span></span>
              <span class="val">{val(w.usd, w.tokens)}</span>
            </a>
          {:else}<div class="empty small">{t('wr_none')}</div>{/each}
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2>{t('us_findings')}</h2><span class="card-sub">{t('us_findings_sub')}</span></div>
      <div class="recs">
        {#each findings as f (f.id)}
          <div class="rec" class:done={checkOf(f)?.check.status === 'fixed'}>
            <div class="rec-icon" style:color={LEVEL[f.level].color}><Icon name={LEVEL[f.level].icon} /></div>
            <div>
              <h3>{t('f_' + f.id + '_t', vars(f))}{#if f.project}<span class="muted small">&nbsp;· {maskProject(f.project)}</span>{/if}</h3>
              <p>{t('f_' + f.id, vars(f))}</p>
              <div class="rec-links">
                <a href={DOCS[f.id]} target="_blank" rel="noopener noreferrer">{t('official_docs')} ↗</a>
              </div>
              {#if f.id !== 'growth'}
                {@const c = checkOf(f)}
                {#if c}{@render status(c)}{/if}
                <FixPanel prompt={promptFor(f)} project={f.project} fixId={f.id} ranAt={c?.fix.start || null} manual={!!c?.fix.manual} />
                {#if !c && f.project}<button class="link-btn small" type="button" onclick={() => setMark(f, true)}>{t('fs_mark')}</button>{/if}
              {/if}
            </div>
          </div>
        {:else}<div class="empty small">{t('us_findings_none')}</div>{/each}
      </div>
      {#if pastFixes.length}
        <h3 class="fix-past-title">{t('fs_past')}</h3>
        <div class="recs">
          {#each pastFixes as c (c.fix.id + c.fix.project)}
            <div class="rec">
              <div class="rec-icon" style:color={c.check.status === 'still' ? 'var(--serious)' : 'var(--good)'}><Icon name={c.check.status === 'still' ? 'alert' : 'check'} /></div>
              <div>
                <h3>{t('fs_name_' + c.fix.id)}<span class="muted small">&nbsp;· {maskProject(c.fix.project)}</span></h3>
                {@render status(c)}
              </div>
            </div>
          {/each}
        </div>
      {/if}
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
