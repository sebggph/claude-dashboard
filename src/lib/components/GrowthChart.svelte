<script>
  // Context size per request, with the auto-compact point and compactions.
  import { t } from '#lib/state.svelte.js';
  import { fmtK, niceMax } from '#lib/charts.js';
  let { points, limit = 0, compactions = [], selected = null, onselect = null } = $props();

  const W = 640, H = 260, m = { l: 48, r: 12, t: 14, b: 28 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const n = $derived(points.length);
  const maxV = $derived(niceMax(Math.max(limit || 0, ...points.map((p) => p.total)) * 1.05));
  const x = (i) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => m.t + ih - (v / maxV) * ih;
  const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => f * maxV));
  const path = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(''));
  const area = $derived(n ? `${path}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : '');
  const xLabels = $derived(n > 1 ? [...new Set([0, Math.floor((n - 1) / 2), n - 1])] : []);

  let svg = $state();
  let hover = $state(null); // index
  function move(e) {
    if (!n) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    hover = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
  }
  const hp = $derived(hover != null ? points[hover] : null);
</script>

<div class="chart">
  <svg bind:this={svg} viewBox="0 0 {W} {H}" role="img" aria-label={t('growth_title')}>
    {#each ticks as v (v)}
      <line class="grid-line" x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} />
      <text class="axis-text" x={m.l - 8} y={y(v) + 4} text-anchor="end">{fmtK(v)}</text>
    {/each}
    {#each xLabels as i (i)}<text class="axis-text" x={x(i)} y={H - 8} text-anchor="middle">{i + 1}</text>{/each}
    <path class="area" d={area} />
    <path class="line" d={path} />
    {#if limit}<line class="threshold" x1={m.l} x2={W - m.r} y1={y(limit)} y2={y(limit)} />{/if}
    {#each compactions.filter((i) => i < n) as i (i)}<circle class="marker" cx={x(i)} cy={y(points[i].total)} r="5" />{/each}
    {#if selected != null && selected < n}
      <line class="selected-line" x1={x(selected)} x2={x(selected)} y1={m.t} y2={m.t + ih} />
      <circle class="selected-dot" cx={x(selected)} cy={y(points[selected].total)} r="6" />
    {/if}
    {#if hp}
      <line class="cross" x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} />
      <circle class="hover-dot" cx={x(hover)} cy={y(hp.total)} r="5" />
    {/if}
    <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" role="presentation" style:cursor={onselect ? 'pointer' : null} onmousemove={move} onmouseleave={() => (hover = null)} onclick={() => onselect && hover != null && onselect(hover)} />
  </svg>
  {#if hp}
    <div class="tooltip" style:left="{(x(hover) / W) * 100}%" style:top="{(y(hp.total) / H) * 100}%">
      <div><b>{t('tt_request', { n: hover + 1 })}</b></div>
      <div class="row"><span>{t('tt_context')}</span><b>{hp.total.toLocaleString()}</b></div>
      <div class="row"><span>{t('tt_cached')}</span><b>{hp.cacheRead.toLocaleString()}</b></div>
      <div class="row"><span>{t('tt_new')}</span><b>{hp.cacheWrite.toLocaleString()}</b></div>
      <div class="row"><span>{t('tt_output')}</span><b>{hp.output.toLocaleString()}</b></div>
    </div>
  {/if}
</div>
<div class="chart-legend">
  <span><i></i>{t('growth_legend_ctx')}</span>
  {#if limit}<span><i class="dash"></i>{t('growth_legend_limit')}</span>{/if}
  {#if compactions.length}<span><i class="ring"></i>{t('growth_legend_compact')}</span>{/if}
</div>
