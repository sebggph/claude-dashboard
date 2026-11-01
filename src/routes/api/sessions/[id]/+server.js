import { json, error } from '@sveltejs/kit';
import { getSession } from '#lib/server/sessions.js';

export function GET({ params }) {
  const s = getSession(params.id);
  if (!s) error(404, 'Session not found');
  return json(s, { headers: { 'cache-control': 'no-store' } });
}
