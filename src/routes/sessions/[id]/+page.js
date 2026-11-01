import { error } from '@sveltejs/kit';
import { load as get } from '#lib/state.svelte.js';

export async function load({ params }) {
  const [session] = await Promise.all([
    get.session(params.id).catch(() => null),
    get.sessions(), get.guide(), get.live(), get.docs(),
  ]);
  if (!session) error(404, 'Session not found');
  return { session };
}
