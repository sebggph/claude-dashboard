<script>
  import { t } from '#lib/state.svelte.js';
  let { error = null } = $props();
</script>

{#if error}
  <div class="card empty"><p><b>{t('error')}</b></p><p class="small muted">{error}</p>
    <button class="btn" type="button" onclick={() => location.reload()}>{t('retry')}</button></div>
{:else}
  <div class="empty">{t('loading')}</div>
{/if}
