<script>
  import Icon from './Icon.svelte';
  import { t, data } from '#lib/state.svelte.js';
  import { STATIC_DEMO } from '#lib/paths.js';
  const key = $derived({ unreadable: 'demo_unreadable', missing: 'demo_missing' }[data.sessions?.demoReason] || 'demo_banner');
</script>

{#if STATIC_DEMO}
  <div class="banner"><Icon name="info" /><span>{t('demo_online')}</span>
    <a class="demo-install" href="https://github.com/sebggph/claude-dashboard#quick-start-docker" target="_blank" rel="noopener noreferrer">{t('demo_install')} ↗</a></div>
{:else if data.sessions?.demo}
  <div class="banner"><Icon name="info" /><span>{t(key)}</span></div>
{/if}
