<script>
  // Guided first-launch tour: highlights one part of the app at a time with a
  // short explanation. Starts by itself on the first visit; restart it from
  // Home or the settings menu. Esc closes, ← → move.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { tick } from 'svelte';
  import { ui, data, t, endTour } from '#lib/state.svelte.js';

  // where: a path, or a function of the loaded data (the latest session).
  const latest = () => data.sessions?.sessions?.[0]?.id;
  const STEPS = [
    { id: 'welcome', where: '/', target: null },
    { id: 'snapshot', where: '/', target: 'snapshot' },
    { id: 'tiles', where: '/', target: 'tiles' },
    { id: 'context', where: () => latest() && `/sessions/${latest()}`, target: 'context' },
    { id: 'legend', where: () => latest() && `/sessions/${latest()}`, target: 'legend' },
    { id: 'report', where: () => latest() && `/sessions/${latest()}`, target: 'report' },
    { id: 'views', where: () => latest() && `/sessions/${latest()}`, target: 'views' },
    { id: 'nav', where: null, target: 'nav' },
    { id: 'tools', where: null, target: 'tools' },
    { id: 'done', where: null, target: null },
  ];

  const step = $derived(ui.tour == null ? null : STEPS[ui.tour]);
  let rect = $state(null); // highlighted element
  let card = $state();
  let cardPos = $state({ top: 0, left: 0, placement: 'center' });

  async function waitFor(sel, ms = 3000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const el = document.querySelector(sel);
      if (el) return el;
      await new Promise((r) => setTimeout(r, 60));
    }
    return null;
  }

  async function show(s) {
    rect = null;
    const where = typeof s.where === 'function' ? s.where() : s.where;
    if (where && page.url.pathname !== where) await goto(where);
    await tick();
    if (s.target) {
      const el = await waitFor(`[data-tour="${s.target}"]`);
      if (!el) { rect = null; return place(); }
      el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      await new Promise((r) => setTimeout(r, 350));
      measure(el);
    }
    place();
    card?.focus();
  }

  function measure(el) {
    const r = el.getBoundingClientRect();
    const pad = 8;
    rect = { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
  }

  // Put the card next to the highlight without covering it: below, above,
  // then to the side; on phones at the top or bottom, away from the highlight.
  function place() {
    const vw = window.innerWidth, vh = window.innerHeight, w = Math.min(380, vw - 32), h = card?.offsetHeight || 220, gap = 14;
    if (!rect) { cardPos = { top: Math.max(16, (vh - h) / 2), left: (vw - w) / 2 }; return; }
    if (vw < 640) {
      const highlightInLowerHalf = rect.top + rect.height / 2 > vh / 2;
      cardPos = { top: highlightInLowerHalf ? 16 : vh - h - 16, left: (vw - w) / 2 };
      return;
    }
    const clampTop = (y) => Math.min(vh - h - 16, Math.max(16, y));
    const clampLeft = (x) => Math.min(vw - w - 16, Math.max(16, x));
    if (rect.top + rect.height + gap + h < vh) cardPos = { top: rect.top + rect.height + gap, left: clampLeft(rect.left + rect.width / 2 - w / 2) };
    else if (rect.top - gap - h > 8) cardPos = { top: rect.top - gap - h, left: clampLeft(rect.left + rect.width / 2 - w / 2) };
    else if (rect.left + rect.width + gap + w < vw - 8) cardPos = { top: clampTop(rect.top + 24), left: rect.left + rect.width + gap };
    else if (rect.left - gap - w > 8) cardPos = { top: clampTop(rect.top + 24), left: rect.left - gap - w };
    else cardPos = { top: vh - h - 16, left: (vw - w) / 2 };
  }

  $effect(() => { if (step) show(step); });

  const next = () => {
    if (ui.tour < STEPS.length - 1) ui.tour = ui.tour + 1;
    else { endTour(); goto('/learn/start-new-project'); }
  };
  const back = () => { if (ui.tour > 0) ui.tour = ui.tour - 1; };
  function onkey(e) {
    if (ui.tour == null) return;
    if (e.key === 'Escape') endTour();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
  }
  function onresize() {
    if (!step?.target) return place();
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) measure(el);
    place();
  }
</script>

<svelte:window onkeydown={onkey} onresize={onresize} onscroll={onresize} />

{#if step}
  <div class="tour-layer" aria-hidden="true">
    {#if rect}
      <div class="tour-hole" style:top="{rect.top}px" style:left="{rect.left}px" style:width="{rect.width}px" style:height="{rect.height}px"></div>
    {:else}
      <div class="tour-dim"></div>
    {/if}
  </div>
  <div class="tour-card card" bind:this={card} tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="tour-title"
    style:top="{cardPos.top}px" style:left="{cardPos.left}px">
    <span class="card-sub">{t('tour_step', { n: ui.tour + 1, t: STEPS.length })}</span>
    <h2 id="tour-title">{t('tour_' + step.id + '_title')}</h2>
    <p aria-live="polite">{t('tour_' + step.id)}</p>
    <div class="tour-dots" aria-hidden="true">{#each STEPS as s, i (s.id)}<i class:on={i === ui.tour}></i>{/each}</div>
    <div class="tour-actions">
      <button class="btn-link" type="button" onclick={endTour}>{t('tour_skip')}</button>
      <span class="spacer"></span>
      {#if ui.tour > 0}<button class="btn" type="button" onclick={back}>{t('gd_prev')}</button>{/if}
      <button class="btn primary" type="button" onclick={next}>{ui.tour === STEPS.length - 1 ? t('tour_finish') : t('gd_next')}</button>
    </div>
  </div>
{/if}
