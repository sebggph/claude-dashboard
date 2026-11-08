import { json } from '@sveltejs/kit';
import { getUsage } from '#lib/server/sessions.js';

export const GET = () => json(getUsage(), { headers: { 'cache-control': 'no-store' } });
