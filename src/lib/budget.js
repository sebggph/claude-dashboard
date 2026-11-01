// Budget alerts: compare usage with optional daily, weekly and per-session
// budgets, in dollars (estimated at API prices) or in tokens processed.
// Days are UTC dates, the same as the transcripts.

import { costOf } from './cost.js';

export const NEAR = 0.8; // "almost there" from 80%

export const todayUTC = (now = new Date()) => now.toISOString().slice(0, 10);
export function lastDays(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)).toISOString().slice(0, 10));
  return out;
}

const tokensOf = (v) => v.input + v.cacheWrite + v.cacheRead + v.output;

/** Usage on the given days across sessions, in the budget's unit. */
export function usageOn(sessions, days, unit, pricing) {
  const set = new Set(days);
  let tokens = 0;
  const buckets = [];
  for (const s of sessions || []) {
    for (const [day, v] of Object.entries(s.byDay || {})) {
      if (!set.has(day)) continue;
      tokens += tokensOf(v);
      buckets.push(...Object.values(v.byModel || {}));
    }
  }
  if (unit === 'tokens') return tokens;
  return pricing ? costOf(buckets, pricing).usd : null;
}

/** One session's usage in the budget's unit. */
export function sessionUsage(s, unit, pricing) {
  if (unit === 'tokens') return s.totals.input + s.totals.cacheWrite + s.totals.cacheRead + s.totals.output;
  return pricing ? costOf(s.byModel, pricing).usd : null;
}

/** { value, limit, pct, level: 'none' | 'ok' | 'near' | 'over' } */
export function status(value, limit) {
  if (!limit || limit <= 0 || value == null) return { value, limit, pct: 0, level: 'none' };
  const pct = value / limit;
  return { value, limit, pct, level: pct >= 1 ? 'over' : pct >= NEAR ? 'near' : 'ok' };
}

/** All budget checks at once, for banners and notifications. */
export function budgetReport(sessions, budget, pricing, now = new Date()) {
  const unit = budget.unit;
  return {
    unit,
    today: status(usageOn(sessions, [todayUTC(now)], unit, pricing), budget.daily),
    week: status(usageOn(sessions, lastDays(7, now), unit, pricing), budget.weekly),
    sessionsOver: budget.session
      ? (sessions || []).filter((s) => status(sessionUsage(s, unit, pricing), budget.session).level === 'over').length
      : 0,
  };
}
