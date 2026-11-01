<script>
  import Icon from './Icon.svelte';
  import { guideMeta } from '#lib/rules.js';
  let { slug } = $props();
  const g = $derived(guideMeta(slug));
</script>

{#if g}<a href="/learn/{slug}"><Icon name="book" small /> {g.title} →</a>{/if}
