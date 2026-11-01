<script>
  import { link } from '#lib/paths.js';
  import Icon from './Icon.svelte';
  import { guideMeta } from '#lib/rules.js';
  let { slug } = $props();
  const g = $derived(guideMeta(slug));
</script>

{#if g}<a href={link(`/learn/${slug}`)}><Icon name="book" small /> {g.title} →</a>{/if}
