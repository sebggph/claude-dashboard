import { load as get } from '#lib/state.svelte.js';

export async function load({ params }) {
  await get.docs();
  return { slug: params.slug };
}
