<script>
  import { link, appPath, STATIC_DEMO } from '#lib/paths.js';
  import { page } from '$app/state';
  import Icon from './Icon.svelte';
  import { ui, data, t, setLang, cycleTheme, setWindow, togglePrivacy, startTour } from '#lib/state.svelte.js';

  const ROUTES = [
    { id: 'home', href: '/', icon: 'home' },
    { id: 'overview', href: '/dashboard', icon: 'overview' },
    { id: 'sessions', href: '/sessions', icon: 'sessions' },
    { id: 'trends', href: '/trends', icon: 'chart' },
    { id: 'usage', href: '/usage', icon: 'gauge' },
    { id: 'guides', href: '/learn', icon: 'book' },
    { id: 'cheatsheet', href: '/cheatsheet', icon: 'sheet' },
    { id: 'news', href: '/news', icon: 'news' },
  ];
  const active = (r) => { const p = appPath(page.url.pathname); return r.href === '/' ? p === '/' : p.startsWith(r.href); };

  let settingsOpen = $state(false);
  const themeIcon = $derived({ auto: 'auto', light: 'sun', dark: 'moon' }[ui.theme]);
  const themeTitle = $derived(`${t('theme')}: ${t('theme_' + ui.theme)}`);

  function outside(e) {
    if (settingsOpen && !e.target.closest('#settings') && !e.target.closest('#settings-btn')) settingsOpen = false;
  }
</script>

<svelte:window onclick={outside} onkeydown={(e) => e.key === 'Escape' && (settingsOpen = false)} />

<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href={link('/')} aria-label="Claude Context Dashboard">
      <span class="brand-mark"><svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M5 19h3v-6H5zm5.5 0h3V6h-3zm5.5 0h3v-9h-3z" /></svg></span>
      <span>Context Dashboard</span>
    </a>
    <nav class="nav" data-tour="nav">
      {#each ROUTES as r (r.id)}
        <a href={link(r.href)} aria-current={active(r) ? 'page' : undefined}><Icon name={r.icon} /><span>{t('nav_' + r.id)}</span></a>
      {/each}
    </nav>
    <div class="tools" data-tour="tools">
      {#if !STATIC_DEMO}<span class="live-dot" class:on={data.live_connected} title={data.live_connected ? t('live_on') : t('live_off')}><i></i>{t('live_label')}</span>{/if}
      <div class="seg" role="group" aria-label={t('language')}>
        {#each ['en', 'es'] as l (l)}
          <button type="button" aria-pressed={ui.lang === l} onclick={() => setLang(l)}>{l.toUpperCase()}</button>
        {/each}
      </div>
      <button class="icon-btn" class:on={ui.privacy} type="button" aria-pressed={ui.privacy} title={ui.privacy ? t('privacy_on') : t('privacy_off')} aria-label={t('privacy')} onclick={togglePrivacy}><Icon name={ui.privacy ? 'eyeoff' : 'eye'} /></button>
      <button class="icon-btn" type="button" title={themeTitle} aria-label={themeTitle} onclick={cycleTheme}><Icon name={themeIcon} /></button>
      <button class="icon-btn" id="settings-btn" type="button" title={t('settings')} aria-label={t('settings')} aria-expanded={settingsOpen} onclick={() => (settingsOpen = !settingsOpen)}><Icon name="gear" /></button>
    </div>
  </div>
  {#if settingsOpen}
    <div class="settings-pop" id="settings">
      <label>{t('set_window')}
        <select value={ui.window} onchange={(e) => setWindow(e.currentTarget.value)}>
          <option value="auto">{t('set_window_auto')}</option>
          <option value="200000">200K</option>
          <option value="1000000">1M</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" checked={ui.privacy} onchange={togglePrivacy} /> {t('privacy')}</label>
      <div class="small muted">{t('privacy_hint')}</div>
      <button class="btn" type="button" onclick={() => { settingsOpen = false; startTour(); }}>{t('tour_restart')}</button>
      <div class="small muted">{t('set_buffer')}: 33K (1M) · 0 (200K). {t('set_buffer_hint')}</div>
    </div>
  {/if}
</header>
