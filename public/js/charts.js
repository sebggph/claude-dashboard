// Hand-made SVG charts (no library needed, works offline).

export const fmtK = (n) => {
  if (n == null) return '–';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(Math.round(n));
};

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/**
 * Line chart of context size per request.
 * opts: { points:[{total, cacheRead, cacheWrite, output, time}], limit, compactions:[index], t:(key,vars)=>string }
 */
export function growthChart(el, { points, limit, compactions = [], t }) {
  const W = 640, H = 260, m = { l: 48, r: 12, t: 14, b: 28 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const maxV = niceMax(Math.max(limit || 0, ...points.map((p) => p.total)) * 1.05);
  const n = points.length;
  const x = (i) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => m.t + ih - (v / maxV) * ih;

  const ticks = [0, .25, .5, .75, 1].map((f) => f * maxV);
  const grid = ticks.map((v) => `<line class="grid-line" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-text" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmtK(v)}</text>`).join('');
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join('');
  const area = n ? `${path}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : '';
  const lim = limit ? `<line class="threshold" x1="${m.l}" x2="${W - m.r}" y1="${y(limit)}" y2="${y(limit)}"/>` : '';
  const marks = compactions.filter((i) => i < n).map((i) => `<circle class="marker" cx="${x(i)}" cy="${y(points[i].total)}" r="5"/>`).join('');
  const xlab = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1].map((i) => `<text class="axis-text" x="${x(i)}" y="${H - 8}" text-anchor="middle">${i + 1}</text>`).join('') : '';

  el.innerHTML = `
    <div class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('growth_title')}">
        ${grid}${xlab}
        <path class="area" d="${area}"/>
        <path class="line" d="${path}"/>
        ${lim}${marks}
        <g class="hover" visibility="hidden">
          <line class="cross" y1="${m.t}" y2="${m.t + ih}"/>
          <circle class="hover-dot" r="5"/>
        </g>
        <rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent" class="hit"/>
      </svg>
      <div class="tooltip" hidden></div>
    </div>
    <div class="chart-legend">
      <span><i></i>${t('growth_legend_ctx')}</span>
      ${limit ? `<span><i class="dash"></i>${t('growth_legend_limit')}</span>` : ''}
      ${compactions.length ? `<span><i class="ring"></i>${t('growth_legend_compact')}</span>` : ''}
    </div>`;

  const svg = el.querySelector('svg');
  const hover = el.querySelector('.hover');
  const tip = el.querySelector('.tooltip');
  const hit = el.querySelector('.hit');
  const show = (evt) => {
    if (!n) return;
    const r = svg.getBoundingClientRect();
    const px = ((evt.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
    const p = points[i];
    hover.setAttribute('visibility', 'visible');
    hover.querySelector('line').setAttribute('x1', x(i));
    hover.querySelector('line').setAttribute('x2', x(i));
    hover.querySelector('circle').setAttribute('cx', x(i));
    hover.querySelector('circle').setAttribute('cy', y(p.total));
    tip.hidden = false;
    tip.style.left = `${(x(i) / W) * r.width}px`;
    tip.style.top = `${(y(p.total) / H) * r.height}px`;
    tip.innerHTML = `<div><b>${t('tt_request', { n: i + 1 })}</b></div>
      <div class="row"><span>${t('tt_context')}</span><b>${p.total.toLocaleString()}</b></div>
      <div class="row"><span>${t('tt_cached')}</span><b>${p.cacheRead.toLocaleString()}</b></div>
      <div class="row"><span>${t('tt_new')}</span><b>${p.cacheWrite.toLocaleString()}</b></div>
      <div class="row"><span>${t('tt_output')}</span><b>${p.output.toLocaleString()}</b></div>`;
  };
  hit.addEventListener('mousemove', show);
  hit.addEventListener('mouseleave', () => { hover.setAttribute('visibility', 'hidden'); tip.hidden = true; });
}
