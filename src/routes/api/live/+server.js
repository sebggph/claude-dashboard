import { json } from '@sveltejs/kit';
import { getLive } from '#lib/server/live.js';

export const GET = () => json(getLive(), { headers: { 'cache-control': 'no-store' } });
