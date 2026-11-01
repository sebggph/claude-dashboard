<script>
  // Current models (official docs) + Claude Code version + service status.
  import Icon from './Icon.svelte';
  import { data, t } from '#lib/state.svelte.js';
  import { cmpVersion, fmtK } from '#lib/rules.js';

  const live = $derived(data.live || {});
  const models = $derived(live.models?.list);
  const latest = $derived(live.version?.latest);
  const status = $derived(live.status && !live.status.error && live.status.indicator ? live.status : null);
  const mine = $derived((data.sessions?.sessions || []).map((x) => x.version).filter(Boolean).sort(cmpVersion).pop());
  const newer = $derived(mine ? (data.news?.releases || []).filter((r) => r.source === 'claude-code' && r.version && cmpVersion(r.version, mine) > 0) : []);
  const ctxCount = $derived(newer.reduce((a, r) => a + r.groups.reduce((b, g) => b + g.items.filter((i) => i.tags.includes('context')).length, 0), 0));
  const behind = $derived(mine && latest && cmpVersion(mine, latest) < 0);
  const stColor = { none: 'var(--good)', minor: 'var(--warning)', major: 'var(--serious)', critical: 'var(--critical)' };
</script>

<div class="grid grid-2 live-row">
  <section class="card">
    <div class="card-head">
      <h2>{t('live_models')}</h2>
      {#if live.models?.page}<a class="small" href={live.models.page} target="_blank" rel="noopener noreferrer">{t('news_open_docs')} ↗</a>{/if}
    </div>
    {#if models}
      <div class="table-wrap"><table>
        <thead><tr><th>{t('col_model')}</th><th class="r">{t('live_ctx')}</th><th class="r">{t('live_out')}</th><th>{t('live_effort')}</th></tr></thead>
        <tbody>
          {#each models as m (m.id)}
            <tr>
              <td><div class="cell-title">{#if m.page}<a href={m.page} target="_blank" rel="noopener noreferrer">{m.name}</a>{:else}{m.name}{/if}</div><div class="cell-sub mono">{m.id}</div></td>
              <td class="r num">{m.contextWindow ? fmtK(m.contextWindow) : '–'}</td>
              <td class="r num">{m.maxOutput ? fmtK(m.maxOutput) : '–'}</td>
              <td><span class="badge">{m.defaultEffort || '–'}</span></td>
            </tr>
          {/each}
        </tbody>
      </table></div>
      <p class="note"><Icon name="info" /><span>{t('live_models_note')}</span></p>
    {:else}<div class="empty small">{t('live_unavailable')}</div>{/if}
  </section>
  <section class="card live-side">
    <div class="card-head">
      <h2>Claude Code</h2>
      {#if live.version?.page}<a class="small" href={live.version.page} target="_blank" rel="noopener noreferrer">{t('news_open')} ↗</a>{/if}
    </div>
    <div class="grid grid-2">
      <div class="kpi"><span class="kpi-label">{t('live_latest')}</span><span class="kpi-value">{latest ? 'v' + latest : '–'}</span></div>
      <div class="kpi"><span class="kpi-label">{t('live_yours')}</span><span class="kpi-value">{mine ? 'v' + mine : '–'}</span>
        {#if mine && latest}<span class="kpi-note">{behind ? t('live_behind') : t('live_uptodate')}</span>{/if}</div>
    </div>
    <div class="legend-rows" style="margin-top:0">
      {#if mine}
        <div class="lrow"><span></span><span>{t('live_since')}</span><span class="v">{newer.length}</span><span class="p"></span></div>
        <div class="lrow"><span></span><span>{t('live_since_ctx')}</span><span class="v">{ctxCount}</span><span class="p"></span></div>
      {/if}
      <div class="lrow"><span></span><span>{t('live_check_how')}</span><span class="v wide"><code>claude --version</code></span></div>
      {#if behind}<div class="lrow"><span></span><span>{t('live_update_how')}</span><span class="v wide"><code>claude update</code></span></div>{/if}
    </div>
    {#if status}
      <div class="status-box">
        <div class="status"><span class="dot" style:background={stColor[status.indicator] || 'var(--text-3)'}></span>{status.description || status.indicator}
          <a class="small" href={status.page} target="_blank" rel="noopener noreferrer">{t('live_status_page')} ↗</a></div>
        {#each status.incidents || [] as x (x.name)}<div class="small muted">• {x.name} ({x.status})</div>{/each}
      </div>
    {/if}
  </section>
</div>
