import { load as get } from '#lib/state.svelte.js';

// Usage data can take a few seconds the first time (it reads every agent
// transcript), so the page loads it itself and shows a message meanwhile.
export async function load() {
  await get.live();
  return {};
}
