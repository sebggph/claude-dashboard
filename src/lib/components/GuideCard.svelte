<script>
  import { link } from '#lib/paths.js';
  import Icon from './Icon.svelte';
  import { t, progress } from '#lib/state.svelte.js';
  import { slugOf } from '#lib/rules.js';
  let { guide, big = false } = $props();
  const slug = $derived(slugOf(guide.file));
  const done = $derived(progress.isRead(slug));
  const steps = $derived(Object.keys(progress.tasks(slug)).length);
</script>

<a class="card guide-card" class:big href={link(`/learn/${slug}`)}>
  <span class="gc-top">
    <span class="gi"><Icon name={guide.icon || 'book'} /></span>
    <span class="badge" class:accent={guide.type === 'tutorial'}>{t('type_' + (guide.type || 'guide'))}</span>
  </span>
  <h3>{guide.title}</h3>
  <p>{guide.summary}</p>
  <span class="gc-meta">
    <span>{guide.minutes ? t('min_read', { n: guide.minutes }) : ''}{guide.level ? ' · ' + t('lvl_' + guide.level) : ''}</span>
    {#if done}<span class="done"><Icon name="check" small /> {t('read_done')}</span>
    {:else if steps}<span class="done">{t('steps_started', { n: steps })}</span>{/if}
  </span>
</a>
