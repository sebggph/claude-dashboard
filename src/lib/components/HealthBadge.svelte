<script>
  import Icon from './Icon.svelte';
  import { t } from '#lib/state.svelte.js';
  import { HEALTH } from '#lib/rules.js';
  let { grade } = $props();
</script>

<span class="health health-{grade}" style:--hc={HEALTH[grade].color}><Icon name={HEALTH[grade].icon} small /> {t('health_' + grade)}</span>
