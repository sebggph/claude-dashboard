<script>
  // Live monitor: agents active in the last 30 minutes, refreshed every few
  // seconds (subagent transcripts change without the main one changing).
  import Icon from '#lib/components/Icon.svelte';
  import Kpi from '#lib/components/Kpi.svelte';
  import DemoBanner from '#lib/components/DemoBanner.svelte';
  import Loading from '#lib/components/Loading.svelte';
  import { ui, data, load, t, saveMonitor } from '#lib/state.svelte.js';
  import { fmtK, maskProject, sessionTitle, shortModel } from '#lib/rules.js';
  import { fmtUSD } from '#lib/cost.js';
  import { link, STATIC_DEMO } from '#lib/paths.js';
  import { monitorView } from '#lib/usage.js';

  let error = $state(null);
  let showFinished = $state(false);
  let now = $state(Date.now());
  $effect(() => {
    load.live();
    const refresh = () => load.agents().then(() => (error = null)).catch((e) => (error = e.message));
    refresh();
    const poll = STATIC_DEMO ? null : setInterval(() => { if (!document.hidden) refresh(); }, 5000);
    const tick = setInterval(() => (now = Date.now()), 1000); // countdowns
    return () => { clearInterval(poll); clearInterval(tick); };
  });

  const pricing = $derived(data.live?.pricing?.list || null);
  const view = $derived(data.agents ? monitorView(data.agents, pricing, now, ui.monitor) : null);
  const usd = (v) => fmtUSD(v, ui.lang);
  const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const mins = (ms) => Math.max(1, Math.round(ms / 60000));
  const agentName = (r) => (r.kind === 'main' ? t('mon_main') : ui.privacy ? t('us_priv_agent', { n: r.id.slice(-4) }) : r.description || r.type || r.id);

  async function toggleNotify(on) {
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
    saveMonitor({ notify: on && typeof Notification !== 'undefined' && Notification.permission === 'granted' });
  }
  const notifyBlocked = $derived(typeof Notification !== 'undefined' && Notification.permission === 'denied');
</script>

<svelte:head><title>{t('mon_title')} · Context Dashboard</title></svelte:head>

<DemoBanner />
<div class="page-head">
  <div><h1>{t('mon_title')}</h1><p>{t('mon_sub')}</p></div>
  {#if !STATIC_DEMO}<span class="live-dot on"><i></i>{t('mon_refresh')}</span>{/if}
</div>

{#if !view}
  {#if error}<Loading {error} />{:else}<div class="card empty"><p>{t('us_loading')}</p></div>{/if}
{:else}
  <div class="stack">
    <div class="grid grid-4">
      <Kpi label={t('mon_running')} value={view.totals.running} note={t('mon_running_note', { n: view.sessions.filter((s) => s.active).length })} />
      <Kpi label={t('mon_context')} value={fmtK(view.totals.context)} note={t('mon_context_note')} />
      <Kpi label={t('mon_expiring')} value={view.totals.idle + view.totals.expired} note={t('mon_expiring_note', { n: view.totals.expired })} />
      <Kpi label={t('mon_restart')} value={view.totals.restart} note={t('mon_restart_note', { k: fmtK(ui.monitor.restartAt) })} />
    </div>

    <section class="card">
      <div class="card-head"><h2>{t('mon_now')}</h2><label class="check small"><input type="checkbox" bind:checked={showFinished} /> {t('mon_show_finished')}</label></div>
      {#each view.sessions as s (s.id)}
        <div class="mon-session" class:quiet={!s.active}>
          <div class="mon-session-head">
            <a href={link(`/sessions/${encodeURIComponent(s.id)}`)}><b>{sessionTitle(s)}</b></a>
            <span class="muted small">{maskProject(s.project)}</span>
          </div>
          <div class="mon-rows">
            {#each s.rows.filter((r) => showFinished || r.status.state !== 'finished') as r (r.id)}
              {@const st = r.status}
              <div class="mon-row {st.state}" class:restart={r.restart}>
                <span class="mon-name" title={agentName(r)}>
                  {agentName(r)}
                  <span class="muted small">{[r.kind === 'workflow' ? t('us_kind_workflow') : r.kind === 'subagent' ? t('mon_subagent') : '', r.model ? shortModel(r.model) : ''].filter(Boolean).join(' · ')}</span>
                </span>
                <span class="mon-ctx">
                  <span class="bar"><span style:width="{Math.min(100, (r.ctx / Math.max(ui.monitor.restartAt * 1.5, 1)) * 100)}%"></span><i style:left="{100 / 1.5}%" title={t('mon_restart_line')}></i></span>
                  <span class="small">{fmtK(r.ctx)}</span>
                </span>
                <span class="mon-state small">
                  {#if st.state === 'working'}<b class="ok">{t('mon_working')}</b>
                  {:else if st.state === 'idle'}<b class="warn">{t('mon_idle', { t: clock(st.expiresIn) })}</b>
                  {:else if st.state === 'expired'}<b class="bad">{t('mon_expired', { m: mins(st.since) })}</b><br /><span class="muted">{t('mon_rewrite', { x: usd(r.rewriteUsd) })}</span>
                  {:else if st.state === 'waiting'}<span class="muted">{t('mon_waiting', { m: mins(st.since) })}</span>
                  {:else}<span class="muted">{t('mon_finished')}</span>{/if}
                  {#if r.restart}<br /><b class="bad">{t('mon_restart_flag')}</b>{/if}
                </span>
                <span class="mon-usd">{usd(r.usd)}</span>
              </div>
            {/each}
            {#if !showFinished && s.rows.some((r) => r.status.state === 'finished')}
              {@const done = s.rows.filter((r) => r.status.state === 'finished')}
              <div class="muted small mon-done">{t('mon_done', { n: done.length, x: usd(done.reduce((a, r) => a + r.usd, 0)) })}</div>
            {/if}
          </div>
        </div>
      {:else}<div class="empty small">{t('mon_none')}</div>{/each}
    </section>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h2>{t('mon_workflows')}</h2><span class="card-sub">{t('mon_workflows_sub')}</span></div>
        <div class="hbars tall">
          {#each view.workflows as w (w.session + w.id)}
            <div class="hbar static">
              <span class="name">{sessionTitle({ id: w.session, title: w.title })}<br /><span class="muted small">{t('mon_wf_agents', { n: w.agents, a: w.active })}</span></span>
              <span class="bar"><span style:width="{Math.min(100, (w.usd / Math.max(ui.monitor.workflowUsd, 0.01)) * 100)}%" style:background={w.over ? 'var(--serious)' : 'var(--s3)'}></span></span>
              <span class="val">{usd(w.usd)}</span>
            </div>
          {:else}<div class="empty small">{t('mon_no_workflows')}</div>{/each}
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>{t('mon_settings')}</h2></div>
        <div class="mon-settings">
          <label>{t('mon_set_restart')}
            <select value={String(ui.monitor.restartAt)} onchange={(e) => saveMonitor({ restartAt: Number(e.currentTarget.value) })}>
              {#each [100000, 150000, 200000, 300000, 400000] as v (v)}<option value={String(v)}>{fmtK(v)}</option>{/each}
            </select>
          </label>
          <label>{t('mon_set_workflow')}
            <input type="number" min="1" step="1" value={ui.monitor.workflowUsd} onchange={(e) => saveMonitor({ workflowUsd: Math.max(1, Number(e.currentTarget.value) || 25) })} />
          </label>
          <label class="check"><input type="checkbox" checked={ui.monitor.notify} disabled={notifyBlocked} onchange={(e) => toggleNotify(e.currentTarget.checked)} /> {t('mon_set_notify')}</label>
          <p class="small muted">{notifyBlocked ? t('bud_notify_blocked') : t('mon_set_notify_hint')}</p>
        </div>
      </section>
    </div>
    <p class="note"><Icon name="info" /><span>{t('mon_note')} <a href="https://code.claude.com/docs/en/sub-agents" target="_blank" rel="noopener noreferrer">{t('official_docs')} ↗</a></span></p>
  </div>
{/if}
