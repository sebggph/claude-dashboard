import { load as get } from '#lib/state.svelte.js';

export async function load() {
  await Promise.all([get.sessions(), get.cheatsheet(), get.live(), get.docs()]);
  get.news(); // fills in when ready
  return {};
}
