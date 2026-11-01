<script>
  import Icon from '#lib/components/Icon.svelte';
  import { ui, data as app, load, t, progress } from '#lib/state.svelte.js';
  import { slugOf } from '#lib/rules.js';
  import { renderMarkdown } from '#lib/markdown.js';

  let { data } = $props();
  const slug = $derived(data.slug);
  const list = $derived(app.docsIndex[ui.lang] || []);
  const idx = $derived(list.findIndex((g) => slugOf(g.file) === slug));
  const guide = $derived(list[idx]);
  const prev = $derived(list[idx - 1]);
  const next = $derived(list[idx + 1]);

  // Load the guide text for the current language.
  let md = $state(null);
  let error = $state(null);
  $effect(() => {
    const lang = ui.lang, s = slug;
    md = null; error = null;
    load.docs(lang).then(() => load.guideText(lang, s)).then((x) => { if (s === slug) md = x; }).catch((e) => (error = e.message));
  });

  const rendered = $derived.by(() => {
    if (!md) return null;
    const ctx = { tasks: 0 };
    const html = renderMarkdown(md, ctx);
    return { html, tasks: ctx.tasks };
  });

  let article = $state();
  let end = $state();
  let heads = $state([]);
  const done = $derived(Object.keys(progress.tasks(slug)).length);

  // After render: restore ticked steps, collect headings, mark read at the end.
  $effect(() => {
    if (!rendered || !article) return;
    const saved = progress.tasks(slug);
    article.querySelectorAll('input[data-task]').forEach((cb) => { cb.checked = !!saved[cb.dataset.task]; });
    heads = [...article.querySelectorAll('h2')].map((h) => ({ id: h.id, text: h.textContent }));
  });
  $effect(() => {
    if (!rendered || !end) return;
    const s = slug;
    const io = new IntersectionObserver((entries) => { if (entries.some((x) => x.isIntersecting)) { progress.markRead(s); io.disconnect(); } });
    io.observe(end);
    return () => io.disconnect();
  });

  function onChange(e) {
    const cb = e.target.closest('input[data-task]');
    if (cb) progress.setTask(slug, cb.dataset.task, cb.checked);
  }
  function reset() {
    progress.resetTasks(slug);
    article.querySelectorAll('input[data-task]').forEach((cb) => { cb.checked = false; });
  }
</script>

<svelte:head><title>{guide ? guide.title : t('gd_title')} · Context Dashboard</title></svelte:head>

<a href="/learn" class="small no-print"><Icon name="back" /> {t('gd_all')}</a>
{#if error}
  <div class="card empty"><p><b>{t('error')}</b></p><p class="small muted">{error}</p></div>
{:else if !rendered || !guide}
  <div class="empty">{t('loading')}</div>
{:else}
  <div class="reader">
    <article class="prose" bind:this={article} onchange={onChange}>
      <div class="guide-meta">
        <span class="badge" class:accent={guide.type === 'tutorial'}>{t('type_' + (guide.type || 'guide'))}</span>
        <span>{t('sec_' + (guide.section || 'concepts'))}</span>
        {#if guide.minutes}<span>· {t('min_read', { n: guide.minutes })}</span>{/if}
        {#if guide.level}<span>· {t('lvl_' + guide.level)}</span>{/if}
      </div>
      {@html rendered.html}
    </article>
    <aside class="toc no-print">
      {#if rendered.tasks}
        <div class="toc-progress">
          <b>{t('steps_done', { n: done, t: rendered.tasks })}</b>
          <span class="track"><span style:width="{(done / rendered.tasks) * 100}%"></span></span>
          {#if done}<button type="button" class="linkish" onclick={reset}>{t('reset_progress')}</button>{/if}
        </div>
      {/if}
      {#if heads.length > 2}
        <div class="toc-title">{t('on_this_page')}</div>
        {#each heads as h (h.id)}
          <button type="button" class="toc-link" onclick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{h.text}</button>
        {/each}
      {/if}
    </aside>
  </div>
  <nav class="guide-nav" bind:this={end}>
    {#if prev}<a href="/learn/{slugOf(prev.file)}"><small>← {t('gd_prev')}</small>{prev.title}</a>{:else}<span></span>{/if}
    {#if next}<a class="next" href="/learn/{slugOf(next.file)}"><small>{t('gd_next')} →</small>{next.title}</a>{:else}<span></span>{/if}
  </nav>
{/if}
