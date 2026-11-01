import { load as get } from '#lib/state.svelte.js';

export async function load() {
  await get.cheatsheet();
  return {};
}
