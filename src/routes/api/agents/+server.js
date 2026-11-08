import { json } from '@sveltejs/kit';
import { liveAgents } from '#lib/server/sessions.js';

// Agents active in the last 30 minutes (live monitor).
export const GET = () => json(liveAgents(), { headers: { 'cache-control': 'no-store' } });
