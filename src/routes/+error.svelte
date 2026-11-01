<script>
  import { link } from '#lib/paths.js';
  import { page } from '$app/state';
  import { t } from '#lib/state.svelte.js';
</script>

<div class="card empty">
  <p><b>{page.status === 404 ? 'Not found' : t('error')}</b></p>
  <p class="small muted">{page.error?.message}</p>
  <a class="btn" href={link('/')}>← Home</a>
</div>
