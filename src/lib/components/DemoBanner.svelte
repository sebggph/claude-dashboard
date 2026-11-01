<script>
  import Icon from './Icon.svelte';
  import { t, data } from '#lib/state.svelte.js';
  const key = $derived({ unreadable: 'demo_unreadable', missing: 'demo_missing' }[data.sessions?.demoReason] || 'demo_banner');
</script>

{#if data.sessions?.demo}
  <div class="banner"><Icon name="info" /><span>{t(key)}</span></div>
{/if}
