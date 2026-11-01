// Estimated cost at official API prices (USD per million tokens, from the
// pricing page). Subscription plans pay a flat fee instead; this shows what the
// same usage would cost on the API, and how much prompt caching saved.

const norm = (model) => String(model || '').toLowerCase().replace(/\[1m\]$/, '').replace(/-\d{8}$/, '');

export function priceFor(model, large, pricing) {
  const rows = (pricing || []).filter((p) => p.id === norm(model));
  return rows.find((r) => r.tier === (large ? 'large' : 'std')) || rows.find((r) => r.tier === 'std') || null;
}

/**
 * @param buckets [{ model, large, input, cw5m, cw1h, read, output }]
 * @param pricing price list from /api/live
 */
export function costOf(buckets, pricing) {
  const parts = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  let withoutCache = 0;
  const unknown = new Set();
  for (const b of buckets || []) {
    const p = priceFor(b.model, b.large, pricing);
    if (!p) { if (b.model && b.model !== 'unknown') unknown.add(b.model); continue; }
    parts.input += (b.input * p.input) / 1e6;
    parts.cacheWrite += (b.cw5m * p.cw5m + b.cw1h * p.cw1h) / 1e6;
    parts.cacheRead += (b.read * p.read) / 1e6;
    parts.output += (b.output * p.output) / 1e6;
    // Same tokens if nothing had been cached: everything billed as normal input.
    withoutCache += ((b.input + b.cw5m + b.cw1h + b.read) * p.input + b.output * p.output) / 1e6;
  }
  const usd = parts.input + parts.cacheWrite + parts.cacheRead + parts.output;
  return { usd, parts, withoutCache, saved: Math.max(0, withoutCache - usd), unknown: [...unknown] };
}

export function fmtUSD(x, lang = 'en') {
  if (x == null || Number.isNaN(x)) return '–';
  const digits = x === 0 || x >= 100 ? 0 : x >= 0.01 ? 2 : 3;
  return new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
}
