<script>
  // Export a session: Markdown report, CSV (breakdown, timeline, tools), JSON, print/PDF.
  // Privacy mode applies to every export.
  import Icon from './Icon.svelte';
  import { ui, data, t, L } from '#lib/state.svelte.js';
  import { breakdownOf, healthOf, sessionTitle, maskProject, maskText, maskPath, fmtK } from '#lib/rules.js';
  import { costOf, fmtUSD } from '#lib/cost.js';
  import { breakdownCSV, timelineCSV, toolsCSV, sessionJSON, reportMarkdown } from '#lib/export.js';
  let { session } = $props();

  let open = $state(false);
  const mask = $derived({ on: ui.privacy, text: maskText, title: sessionTitle, project: maskProject, path: maskPath });
  const base = $derived(`claude-session-${session.id.slice(0, 8)}`);

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    open = false;
  }

  function report() {
    const bd = breakdownOf(session);
    const h = healthOf(session, data.sessions?.memoryFiles);
    const pricing = data.live?.pricing?.list;
    const c = pricing ? costOf(session.byModel, pricing) : null;
    return reportMarkdown(session, {
      t, fmt: fmtK, mask, win: bd.win,
      health: { grade: h.grade, recs: h.recs.map((r) => ({ title: L(r.def.title), why: r.why })) },
      cost: c ? { usd: fmtUSD(c.usd, ui.lang), saved: fmtUSD(c.saved, ui.lang) } : null,
    });
  }

  const items = $derived([
    { id: 'md', icon: 'sheet', label: t('exp_report'), run: () => download(`${base}-report.md`, report(), 'text/markdown') },
    { id: 'csv1', icon: 'chart', label: t('exp_breakdown'), run: () => download(`${base}-breakdown.csv`, breakdownCSV(session, breakdownOf(session).win), 'text/csv') },
    { id: 'csv2', icon: 'route', label: t('exp_timeline'), run: () => download(`${base}-timeline.csv`, timelineCSV(session, mask), 'text/csv') },
    { id: 'csv3', icon: 'plug', label: t('exp_tools'), run: () => download(`${base}-tools.csv`, toolsCSV(session), 'text/csv') },
    { id: 'json', icon: 'layers', label: t('exp_json'), run: () => download(`${base}.json`, sessionJSON(session, mask), 'application/json') },
    { id: 'print', icon: 'print', label: t('exp_print'), run: () => { open = false; setTimeout(() => window.print(), 50); } },
  ]);
</script>

<svelte:window onclick={(e) => { if (open && !e.target.closest('.export-menu')) open = false; }} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="export-menu no-print">
  <button class="btn" type="button" aria-haspopup="menu" aria-expanded={open} onclick={() => (open = !open)}><Icon name="ext" /> {t('exp_title')}</button>
  {#if open}
    <div class="export-pop" role="menu">
      {#each items as it (it.id)}
        <button type="button" role="menuitem" onclick={it.run}><Icon name={it.icon} /> {it.label}</button>
      {/each}
      {#if ui.privacy}<p class="small muted">{t('exp_private')}</p>{/if}
    </div>
  {/if}
</div>
