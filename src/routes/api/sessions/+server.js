import { json } from '@sveltejs/kit';
import { listSessions } from '#lib/server/sessions.js';

export const GET = () => json(listSessions(), { headers: { 'cache-control': 'no-store' } });
