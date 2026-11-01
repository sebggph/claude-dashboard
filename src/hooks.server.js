// Runs once when the server starts.
import * as news from '#lib/server/news.js';
import * as live from '#lib/server/live.js';
import { describeSource } from '#lib/server/sessions.js';

export async function init() {
  console.log('Claude Context Dashboard');
  console.log(describeSource());
  news.start();
  live.start();
}

// Read-only app: refuse anything but GET/HEAD, and add basic security headers.
export async function handle({ event, resolve }) {
  if (!['GET', 'HEAD'].includes(event.request.method)) {
    return new Response(JSON.stringify({ error: 'read-only' }), { status: 405, headers: { 'content-type': 'application/json' } });
  }
  const res = await resolve(event);
  res.headers.set('x-content-type-options', 'nosniff');
  res.headers.set('referrer-policy', 'no-referrer');
  return res;
}
