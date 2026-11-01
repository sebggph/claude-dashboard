import { load as get } from '#lib/state.svelte.js';

export async function load() {
  await Promise.all([get.live(), get.sessions(), get.news()]);
  return {};
}
