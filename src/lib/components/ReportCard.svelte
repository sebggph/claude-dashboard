<script>
  // One-glance verdict for a session, with its top fixes and a copy-for-chat summary.
  import Icon from './Icon.svelte';
  import HealthBadge from './HealthBadge.svelte';
  import { data, t, L } from '#lib/state.svelte.js';
  import { healthOf, sessionTitle, shortModel, fmtK, pct, winLabel } from '#lib/rules.js';
  let { session } = $props();

  const h = $derived(healthOf(session, data.sessions?.memoryFiles));
  const fixes = $derived(h.recs.slice(0, 3));
  let copied = $state(false);

  function summary() {
    const s = session;
    const lines = [
      `${t('rc_text_title')}: ${sessionTitle(s)} · ${t('health_' + h.grade).toUpperCase()}`,
      `${t('rc_text_context')}: ${pct(h.used)} ${t('rc_text_of')} ${winLabel(h.win)} (${fmtK(s.contextTokens)}) · ${shortModel(s.model)} · ${s.requests} ${t('rc_text_requests')} · ${s.compactions} ${t('rc_text_compactions')} · ${t('rc_text_cache')} ${pct(s.cacheHitRate)}`,
    ];
    if (fixes.length) {
      lines.push(`${t('rc_fixes')}:`);
      fixes.forEach((r, i) => lines.push(`${i + 1}. ${L(r.def.title)}: ${r.why}`));
    } else lines.push(t('rc_none'));
    lines.push(t('rc_text_footer'));
    return lines.join('\n');
  }
  async function copy() {
    try { await navigator.clipboard.writeText(summary()); copied = true; setTimeout(() => (copied = false), 2000); } catch { /* clipboard blocked */ }
  }
</script>

<section class="card report" style:--hc="var(--{h.grade === 'lean' ? 'good' : h.grade === 'okay' ? 'warning' : 'serious'})">
  <div class="report-main">
    <span class="card-sub">{t('rc_title')}</span>
    <div class="report-grade"><HealthBadge grade={h.grade} /></div>
    <p>{t('rc_' + h.grade)}</p>
  </div>
  <div class="report-fixes">
    <span class="card-sub">{t('rc_fixes')}</span>
    {#if fixes.length}
      <ol>{#each fixes as r (r.id)}<li><b>{L(r.def.title)}</b> <span class="muted small">{r.why}</span></li>{/each}</ol>
    {:else}<p class="muted">{t('rc_none')}</p>{/if}
    <button class="btn" type="button" onclick={copy}><Icon name={copied ? 'check' : 'sheet'} /> {copied ? t('rc_copied') : t('rc_copy')}</button>
  </div>
</section>
