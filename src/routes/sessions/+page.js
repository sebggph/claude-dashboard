import { load as get } from '#lib/state.svelte.js';

export async function load() {
  await Promise.all([get.sessions(), get.live(), get.guide()]);
  return {};
}
