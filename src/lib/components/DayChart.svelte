<script>
  // One series over days: thin bars (counts, money) or a line (rates).
  let { days, kind = 'bars', format = (v) => String(v), label = '', max = null } = $props();

  const W = 640, H = 220, m = { l: 52, r: 10, t: 12, b: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const n = $derived(days.length);
  const top = $derived(max ?? niceMax(Math.max(0, ...days.map((d) => d.value || 0))));
  const step = $derived(n ? iw / n : iw);
  const bw = $derived(Math.max(2, Math.min(18, step * 0.62)));
  const cx = (i) => m.l + step * i + step / 2;
  const y = (v) => m.t + ih - ((v || 0) / (top || 1)) * ih;
  const ticks = $derived([0, 0.5, 1].map((f) => f * top));
  const labels = $derived(n > 1 ? [...new Set([0, Math.floor((n - 1) / 2), n - 1])] : n ? [0] : []);
  const linePath = $derived(days.map((d, i) => (d.value == null ? null : `${cx(i).toFixed(1)},${y(d.value).toFixed(1)}`)).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p).join(''));
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= v) return k * p;
    return 10 * p;
  }
  const shortDay = (d) => d.slice(5);

  let svg = $state();
  let hover = $state(null);
  function move(e) {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    hover = Math.max(0, Math.min(n - 1, Math.floor((px - m.l) / step)));
  }
  const hd = $derived(hover != null ? days[hover] : null);
</script>

<div class="chart">
  <svg bind:this={svg} viewBox="0 0 {W} {H}" role="img" aria-label={label}>
    {#each ticks as v (v)}
      <line class="grid-line" x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} />
      <text class="axis-text" x={m.l - 8} y={y(v) + 4} text-anchor="end">{format(v)}</text>
    {/each}
    {#each labels as i (i)}<text class="axis-text" x={cx(i)} y={H - 8} text-anchor="middle">{shortDay(days[i].day)}</text>{/each}
    {#if kind === 'bars'}
      {#each days as d, i (d.day)}
        {#if d.value > 0}<rect class="bar" class:dim={hover != null && hover !== i} x={cx(i) - bw / 2} y={y(d.value)} width={bw} height={Math.max(1, m.t + ih - y(d.value))} rx="3" />{/if}
      {/each}
    {:else}
      <path class="line" d={linePath} />
      {#each days as d, i (d.day)}{#if d.value != null && hover === i}<circle class="hover-dot" cx={cx(i)} cy={y(d.value)} r="5" />{/if}{/each}
    {/if}
    {#if hd && kind === 'line'}<line class="cross" x1={cx(hover)} x2={cx(hover)} y1={m.t} y2={m.t + ih} />{/if}
    <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" role="presentation" onmousemove={move} onmouseleave={() => (hover = null)} />
  </svg>
  {#if hd}
    <div class="tooltip" style:left="{(cx(hover) / W) * 100}%" style:top="{(y(hd.value || 0) / H) * 100}%">
      <div><b>{hd.day}</b></div>
      <div class="row"><span>{label}</span><b>{hd.value == null ? '–' : format(hd.value)}</b></div>
    </div>
  {/if}
</div>
