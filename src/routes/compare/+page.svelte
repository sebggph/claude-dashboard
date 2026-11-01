<script>
  import { link } from '#lib/paths.js';
  import { goto } from '$app/navigation';
  import Icon from '#lib/components/Icon.svelte';
  import Explain from '#lib/components/Explain.svelte';
  import HealthBadge from '#lib/components/HealthBadge.svelte';
  import DeltaBadge from '#lib/components/DeltaBadge.svelte';
  import DemoBanner from '#lib/components/DemoBanner.svelte';
  import { ui, data as app, t } from '#lib/state.svelte.js';
  import { breakdownOf, healthOf, sessionTitle, maskProject, shortModel, fmtK, pct, ago, GUIDE_KEY } from '#lib/rules.js';
  import { setupOf, conversationOf, delta, setupChanges, toolsCompared, SETUP_PARTS, CONVO_PARTS } from '#lib/compare.js';
  import { costOf, fmtUSD } from '#lib/cost.js';

  let { data } = $props();
  const sessions = $derived(app.sessions?.sessions || []);
  const A = $derived(data.sa), B = $derived(data.sb);
  const pricing = $derived(app.live?.pricing?.list);

  function pick(side, id) {
    const q = new URLSearchParams({ a: side === 'a' ? id : data.a || '', b: side === 'b' ? id : data.b || '' });
    goto(link(`/compare?${q}`), { replaceState: true, noScroll: true, keepFocus: true });
  }

  const setupA = $derived(A ? setupOf(A) : null), setupB = $derived(B ? setupOf(B) : null);
  const convA = $derived(A ? conversationOf(A) : null), convB = $derived(B ? conversationOf(B) : null);
  const setupMax = $derived(setupA && setupB ? Math.max(1, ...SETUP_PARTS.map((k) => Math.max(setupA.parts[k], setupB.parts[k]))) : 1);
  const convMax = $derived(convA && convB ? Math.max(1, ...CONVO_PARTS.map((k) => Math.max(convA.parts[k], convB.parts[k]))) : 1);
  const costA = $derived(A && pricing ? costOf(A.byModel, pricing) : null), costB = $derived(B && pricing ? costOf(B.byModel, pricing) : null);
  const bdA = $derived(A ? breakdownOf(A) : null), bdB = $derived(B ? breakdownOf(B) : null);

  const PART_KEY = { system_prompt: 'system_prompt', mcp_tools: 'mcp_tools', memory_files: 'memory_files', builtin: 'system_tools', skills: 'skills', listings: 'mcp_instructions',
    user: 'user_messages', assistant: 'assistant_text', thinking: 'thinking', tool_calls: 'tool_calls', tool_results: 'tool_results', other: 'messages' };

  const usd = (v) => (v == null ? '–' : fmtUSD(v, ui.lang));
  const metrics = $derived(A && B ? [
    { k: 'cmp_m_context', a: A.contextTokens, b: B.contextTokens, f: fmtK, better: 'lower' },
    { k: 'cmp_m_used', a: bdA.used / bdA.win, b: bdB.used / bdB.win, f: (v) => pct(v), better: 'lower' },
    { k: 'st_peak', a: A.peakTokens, b: B.peakTokens, f: fmtK, better: 'lower' },
    { k: 'st_requests', a: A.requests, b: B.requests, f: (v) => v, better: null },
    { k: 'col_prompts', a: A.userPrompts, b: B.userPrompts, f: (v) => v, better: null },
    { k: 'col_compact', a: A.compactions, b: B.compactions, f: (v) => v, better: 'lower' },
    { k: 'kpi_cache', a: A.cacheHitRate, b: B.cacheHitRate, f: (v) => pct(v), better: 'higher' },
    { k: 'cost_est', a: costA?.usd, b: costB?.usd, f: usd, better: 'lower' },
    { k: 'cmp_m_cost_req', a: costA && A.requests ? costA.usd / A.requests : null, b: costB && B.requests ? costB.usd / B.requests : null, f: usd, better: 'lower' },
  ] : []);

  // Plain-language takeaways.
  const takeaways = $derived.by(() => {
    if (!A || !B) return [];
    const out = [];
    const d = delta(setupA.total, setupB.total);
    if (d.verdict !== 'same') {
      const top = setupChanges(A, B)[0];
      out.push(t(d.diff < 0 ? 'cmp_tk_setup_smaller' : 'cmp_tk_setup_bigger', { t: fmtK(Math.abs(d.diff)), p: Math.abs(Math.round(d.rel * 100)) + '%' }) +
        (top ? ' ' + t('cmp_tk_mostly', { x: t('cmp_part_' + top.key).toLowerCase(), t: fmtK(Math.abs(top.diff)) }) : ''));
    } else out.push(t('cmp_tk_setup_same', { t: fmtK(setupB.total) }));
    const cache = delta(A.cacheHitRate, B.cacheHitRate, 'higher');
    if (cache.verdict !== 'same') out.push(t(cache.verdict === 'better' ? 'cmp_tk_cache_up' : 'cmp_tk_cache_down', { a: pct(A.cacheHitRate), b: pct(B.cacheHitRate) }));
    if (costA && costB && A.requests && B.requests) {
      const c = delta(costA.usd / A.requests, costB.usd / B.requests);
      if (c.verdict !== 'same') out.push(t(c.verdict === 'better' ? 'cmp_tk_cost_down' : 'cmp_tk_cost_up', { p: Math.abs(Math.round(c.rel * 100)) + '%' }));
    }
    if (A.model !== B.model) out.push(t('cmp_tk_models', { a: shortModel(A.model), b: shortModel(B.model) }));
    return out;
  });
  const tools = $derived(A && B ? toolsCompared(A, B) : []);
  const toolName = (x) => (x.server ? x.name.split('__').slice(2).join('__') : x.name);
  const label = (s) => `${sessionTitle(s)} · ${maskProject(s.project)} · ${ago(s.end)}`;
</script>

<svelte:head><title>{t('cmp_title')} · Context Dashboard</title></svelte:head>

<DemoBanner />
<a href={link('/sessions')} class="small"><Icon name="back" /> {t('back')}</a>
<div class="page-head" style="margin-top:10px">
  <div><h1>{t('cmp_title')}</h1><p>{t('cmp_sub')}</p></div>
</div>

<div class="stack">
  <div class="grid grid-2">
    {#each [['a', A, 'cmp_a'], ['b', B, 'cmp_b']] as [side, s, lbl] (side)}
      <section class="card cmp-pick cmp-{side}">
        <span class="cmp-tag">{side.toUpperCase()}</span>
        <label class="small muted" for="pick-{side}">{t(lbl)}</label>
        <select id="pick-{side}" class="input" value={side === 'a' ? data.a : data.b} onchange={(e) => pick(side, e.currentTarget.value)}>
          {#each sessions as x (x.id)}<option value={x.id} disabled={x.id === (side === 'a' ? data.b : data.a)}>{label(x)}</option>{/each}
        </select>
        {#if s}
          <div class="chips">
            <span class="chip">{shortModel(s.model)}</span><span class="chip">{s.requests} {t('rc_text_requests')}</span>
            <HealthBadge grade={healthOf(s, app.sessions?.memoryFiles).grade} />
            <a class="small" href={link(`/sessions/${s.id}`)}>{t('cmp_open')} →</a>
          </div>
        {/if}
      </section>
    {/each}
  </div>

  {#if sessions.length < 2}
    <div class="card empty">{t('cmp_need_two')}</div>
  {:else if A && B}
    <section class="card">
      <div class="card-head"><h2>{t('cmp_takeaways')}</h2></div>
      <ul class="takeaways">{#each takeaways as x, i (i)}<li>{x}</li>{/each}</ul>
    </section>

    <div class="grid grid-2">
      {#each [['setup', setupA, setupB, SETUP_PARTS, setupMax, 'cmp_setup', 'cmp_setup_sub'], ['convo', convA, convB, CONVO_PARTS, convMax, 'cmp_convo', 'cmp_convo_sub']] as [id, xa, xb, keys, max, title, sub] (id)}
        <section class="card">
          <div class="card-head"><h2>{t(title)}</h2></div>
          <p class="card-sub sub-lead">{t(sub)}</p>
          <div class="cmp-rows">
            <div class="cmp-row head"><span></span><span class="cmp-a-lbl">A</span><span class="cmp-b-lbl">B</span><span class="r">{t('cmp_change')}</span></div>
            {#each keys as k (k)}
              {#if xa.parts[k] || xb.parts[k]}
                <div class="cmp-row">
                  <Explain key={PART_KEY[k]} label={t('cmp_part_' + k)} />
                  <span class="cmp-bar"><i class="a" style:width="{(xa.parts[k] / max) * 100}%"></i><b>{fmtK(xa.parts[k])}</b></span>
                  <span class="cmp-bar"><i class="b" style:width="{(xb.parts[k] / max) * 100}%"></i><b>{fmtK(xb.parts[k])}</b></span>
                  <span class="r"><DeltaBadge d={delta(xa.parts[k], xb.parts[k], id === 'setup' ? 'lower' : null)} /></span>
                </div>
              {/if}
            {/each}
            <div class="cmp-row total"><span>{t('cmp_total')}</span><span>{fmtK(xa.total)}</span><span>{fmtK(xb.total)}</span>
              <span class="r"><DeltaBadge d={delta(xa.total, xb.total, id === 'setup' ? 'lower' : null)} /></span></div>
          </div>
        </section>
      {/each}
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h2>{t('cmp_numbers')}</h2></div>
        <div class="table-wrap"><table>
          <thead><tr><th></th><th class="r">A</th><th class="r">B</th><th class="r">{t('cmp_change')}</th></tr></thead>
          <tbody>
            {#each metrics as m (m.k)}
              <tr><td>{t(m.k)}</td><td class="r num">{m.a == null ? '–' : m.f(m.a)}</td><td class="r num">{m.b == null ? '–' : m.f(m.b)}</td>
                <td class="r"><DeltaBadge d={delta(m.a, m.b, m.better)} /></td></tr>
            {/each}
          </tbody>
        </table></div>
      </section>
      <section class="card">
        <div class="card-head"><h2>{t('tools_title')}</h2><span class="card-sub">{t('cmp_tools_sub')}</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>{t('col_tool')}</th><th class="r">A</th><th class="r">B</th></tr></thead>
          <tbody>
            {#each tools as x (x.name)}
              <tr><td>{#if x.server}<span class="badge">MCP</span> {/if}<span class="mono small">{toolName(x)}</span></td>
                <td class="r num">{x.a.calls ? `${x.a.calls}× · ${fmtK(x.a.tokens)}` : '–'}</td>
                <td class="r num">{x.b.calls ? `${x.b.calls}× · ${fmtK(x.b.tokens)}` : '–'}</td></tr>
            {/each}
          </tbody>
        </table></div>
      </section>
    </div>
    <p class="note"><Icon name="info" /><span>{t('cmp_note')}</span></p>
  {:else}
    <div class="empty">{t('loading')}</div>
  {/if}
</div>
