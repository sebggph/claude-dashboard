<script>
  import Icon from '#lib/components/Icon.svelte';
  import StackBar from '#lib/components/StackBar.svelte';
  import GuideCard from '#lib/components/GuideCard.svelte';
  import DemoBanner from '#lib/components/DemoBanner.svelte';
  import { ui, data, t, progress } from '#lib/state.svelte.js';
  import { breakdownOf, windowFor, pct, pctSmart, fmtK, winLabel, shortModel, ago, fmtDate, sourceName, slugOf, sessionTitle } from '#lib/rules.js';
  import { inline } from '#lib/markdown.js';

  const sessions = $derived(data.sessions?.sessions || []);
  const guides = $derived(data.docsIndex[ui.lang] || []);
  const read = $derived(guides.filter((g) => progress.isRead(slugOf(g.file))).length);
  const nextGuide = $derived(guides.find((g) => !progress.isRead(slugOf(g.file))) || guides[0]);
  const start = $derived(guides.find((g) => g.section === 'start'));
  const latest = $derived(sessions[0]);
  const bd = $derived(latest ? breakdownOf(latest) : null);
  const avgUsed = $derived(sessions.length ? sessions.reduce((a, x) => a + x.contextTokens / windowFor(x), 0) / sessions.length : 0);
  const cmdCount = $derived(data.cheatsheet ? data.cheatsheet.sections.reduce((a, x) => a + x.items.length, 0) : 0);
  const ccLatest = $derived((data.news?.releases || []).find((r) => r.source === 'claude-code'));

  const ctxNews = $derived.by(() => {
    const out = [];
    for (const r of data.news?.releases || []) {
      for (const g of r.groups) for (const it of g.items) if (it.tags.includes('context') && g.type !== 'fixed') out.push({ r, it });
      if (out.length >= 4) break;
    }
    return out.slice(0, 4);
  });

  const tiles = $derived([
    { href: '/dashboard', icon: 'overview', title: t('nav_overview'), desc: t('home_t_dash'), stat: t('home_s_dash', { p: pct(avgUsed) }) },
    { href: '/sessions', icon: 'sessions', title: t('nav_sessions'), desc: t('home_t_sessions'), stat: t(sessions.length === 1 ? 'home_s_session_one' : 'home_s_sessions', { n: sessions.length }) },
    { href: '/learn', icon: 'book', title: t('nav_guides'), desc: t('home_t_learn'), stat: t('progress_read', { n: read, t: guides.length }) },
    { href: '/cheatsheet', icon: 'sheet', title: t('nav_cheatsheet'), desc: t('home_t_cheat'), stat: t('home_s_cheat', { n: cmdCount }) },
    { href: '/news', icon: 'news', title: t('nav_news'), desc: t('home_t_news'), stat: ccLatest ? t('home_s_news_v', { v: ccLatest.version }) : t('home_s_news') },
    { href: '/learn/06-reading-the-dashboard', icon: 'chart', title: t('home_t_help_title'), desc: t('home_t_help'), stat: t('min_read', { n: 4 }) },
  ]);
</script>

<DemoBanner />

<section class="hero card">
  <div class="hero-text">
    <span class="eyebrow">{t('home_eyebrow')}</span>
    <h1>{t('home_title')}</h1>
    <p>{t('home_sub')}</p>
    <div class="hero-cta">
      {#if start}<a class="btn primary" href="/learn/{slugOf(start.file)}"><Icon name="rocket" /> {t('home_cta_start')}</a>{/if}
      <a class="btn" href="/dashboard"><Icon name="overview" /> {t('home_cta_dash')}</a>
    </div>
  </div>
  <div class="hero-side">
    {#if latest}
      <a class="snapshot" href="/sessions/{latest.id}">
        <span class="card-sub">{t('home_latest')}</span>
        <span class="snap-title">{sessionTitle(latest)}</span>
        <span class="snap-pct">{t('ctx_used', { p: pctSmart(bd.used / bd.win) })}</span>
        <StackBar {bd} height={10} />
        <span class="card-sub">{fmtK(bd.used)} / {winLabel(bd.win)} · {shortModel(latest.model)} · {ago(latest.end)}</span>
      </a>
    {/if}
  </div>
</section>

<div class="grid grid-3 tiles">
  {#each tiles as tile (tile.href)}
    <a class="card tile" href={tile.href}>
      <span class="tile-icon"><Icon name={tile.icon} /></span>
      <span class="tile-body"><h3>{tile.title}</h3><p>{tile.desc}</p></span>
      <span class="tile-foot"><span class="tile-stat">{tile.stat}</span><Icon name="arrow" small /></span>
    </a>
  {/each}
</div>

<div class="grid grid-2">
  <section class="card">
    <div class="card-head"><h2>{t('home_whatsnew')}</h2><a class="small" href="/news">{t('see_all')} →</a></div>
    {#if !data.news}
      <div class="empty small">{t('loading')}</div>
    {:else if !ctxNews.length}
      <div class="empty small">{t('news_empty')}</div>
    {:else}
      <div class="news-mini">
        {#each ctxNews as { r, it }, i (i)}
          <div class="nm-item">
            <span class="badge">{r.version ? 'v' + r.version : sourceName(r.source)}</span>
            <span class="nm-text">{@html inline(it.text)}</span>
            <span class="card-sub">{fmtDate(r.date)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </section>
  <section class="card">
    <div class="card-head"><h2>{t('home_continue')}</h2><a class="small" href="/learn">{t('see_all')} →</a></div>
    <div class="learn-progress" style="margin-bottom:14px">
      <span>{t('progress_read', { n: read, t: guides.length })}</span>
      <span class="track"><span style:width="{guides.length ? (read / guides.length) * 100 : 0}%"></span></span>
    </div>
    {#if nextGuide}<div class="home-next"><GuideCard guide={nextGuide} /></div>{/if}
  </section>
</div>
