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

/**
 * A session's usage per day, including its subagents and workflow agents
 * (they use tokens too). Returns [day, { requests, input, cacheWrite, cacheRead, output, byModel }].
 */
export function daysOf(s) {
  const out = new Map(Object.entries(s.byDay || {}).map(([d, v]) => [d, { ...v, byModel: { ...v.byModel } }]));
  for (const [day, v] of Object.entries((s.agentUsage && s.agentUsage.byDay) || {})) {
    const d = out.get(day);
    if (!d) { out.set(day, v); continue; }
    d.requests += v.requests; d.input += v.input; d.cacheWrite += v.cacheWrite; d.cacheRead += v.cacheRead; d.output += v.output;
    // Agent buckets get their own keys so costOf sees each one.
    for (const [k, b] of Object.entries(v.byModel || {})) d.byModel['agents|' + k] = b;
  }
  return [...out.entries()];
}

/** Usage on the given days across sessions (agents included), in the budget's unit. */
export function usageOn(sessions, days, unit, pricing) {
  const set = new Set(days);
  let tokens = 0;
  const buckets = [];
  for (const s of sessions || []) {
    for (const [day, v] of daysOf(s)) {
      if (!set.has(day)) continue;
      tokens += tokensOf(v);
      buckets.push(...Object.values(v.byModel || {}));
    }
  }
  if (unit === 'tokens') return tokens;
  return pricing ? costOf(buckets, pricing).usd : null;
}

/** One session's usage in the budget's unit, agents included. */
export function sessionUsage(s, unit, pricing) {
  // Its subagents and workflow agents count too.
  const agents = s.agentUsage || { tokens: 0, byModel: [] };
  if (unit === 'tokens') return s.totals.input + s.totals.cacheWrite + s.totals.cacheRead + s.totals.output + (agents.tokens || 0);
  return pricing ? costOf([...s.byModel, ...(agents.byModel || [])], pricing).usd : null;
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
