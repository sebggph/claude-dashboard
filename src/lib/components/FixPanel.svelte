<script>
  // A ready-to-run fix: a prompt for Claude, a link that opens Claude Code in
  // the right project with the prompt typed in, and the same as a command.
  // Nothing is sent until you press Enter in Claude Code.
  //
  // Against running the same fix twice by accident: once a fix was opened here
  // (remembered in this browser) or a fix session shows up in the transcripts
  // (`ranAt`), Open and Copy need a second click.
  import Icon from './Icon.svelte';
  import { ui, t, store } from '#lib/state.svelte.js';
  import { maskProject, ago } from '#lib/rules.js';
  import { fixCommand, deepLink } from '#lib/usage.js';
  import { STATIC_DEMO } from '#lib/paths.js';

  let { prompt, project = null, fixId, ranAt = null } = $props();
  let open = $state(false);
  let copied = $state('');
  let armed = $state(''); // which button is waiting for its confirming click
  const command = $derived(fixCommand(project, prompt));
  // One click: a terminal opens with Claude Code in the project and the prompt typed in.
  // Not in the online demo (its project folders don't exist on your computer).
  const link = $derived(STATIC_DEMO ? null : deepLink(project, prompt));

  const key = $derived(`fixopened.${fixId}|${project}`);
  let openedAt = $state(null);
  $effect(() => { openedAt = store.get(key, '') || null; });
  // Opened here in the last day, and no fix session seen since then.
  const openedRecently = $derived(!!openedAt && Date.now() - new Date(openedAt) < 86400000 && (!ranAt || openedAt > ranAt));
  const lastTime = $derived(openedRecently ? openedAt : ranAt);
  const needsConfirm = $derived(!!lastTime);

  function remember() { openedAt = new Date().toISOString(); store.set(key, openedAt); }

  // First click only arms the button when this fix already ran or was opened.
  function guard(e, what) {
    if (needsConfirm && armed !== what) {
      e.preventDefault();
      armed = what;
      setTimeout(() => { if (armed === what) armed = ''; }, 8000);
      return false;
    }
    armed = '';
    return true;
  }

  async function copy(what, text) {
    try { await navigator.clipboard.writeText(text); copied = what; setTimeout(() => (copied = ''), 1500); } catch { /* clipboard blocked */ }
  }
  function onOpen(e) { if (!guard(e, 'open')) return; remember(); copy('open', command); }
  function onCopy(e, what, text) { if (!guard(e, what)) return; if (what === 'cmd') remember(); copy(what, text); }
  const label = (what, normal, done) => (armed === what ? t('fix_confirm') : copied === what ? done : normal);
</script>

<div class="fix">
  <button class="btn" type="button" aria-expanded={open} onclick={() => (open = !open)}>
    <Icon name="wrench" />{open ? t('fix_hide') : ranAt ? t('fix_again') : t('fix_btn')}
  </button>
  {#if open}
    <div class="fix-panel">
      {#if needsConfirm}
        <p class="small fix-warn"><Icon name="alert" />{openedRecently ? t('fix_opened', { ago: ago(openedAt) }) : t('fix_ran', { ago: ago(ranAt) })}</p>
      {/if}
      <p class="small">{link ? t('fix_open_intro', { p: maskProject(project) }) : project ? t('fix_intro', { p: maskProject(project) }) : t('fix_intro_any')}</p>
      {#if ui.privacy}
        <p class="small muted">{t('fix_hidden')}</p>
      {:else}
        <pre class="fix-cmd">{command}</pre>
      {/if}
      <div class="fix-actions">
        {#if link}
          <!-- Also copies the command, as a backup if the link doesn't open. -->
          <a class="btn" class:primary={!needsConfirm} href={link} onclick={onOpen}><Icon name="terminal" />{label('open', t('fix_open'), t('fix_opening'))}</a>
        {/if}
        <button class="btn" class:primary={!link && !needsConfirm} type="button" onclick={(e) => onCopy(e, 'cmd', command)}>{#if !link}<Icon name="terminal" />{/if}{label('cmd', t('fix_copy_cmd'), t('fix_copied'))}</button>
        <button class="btn" type="button" onclick={(e) => onCopy(e, 'prompt', prompt)}>{label('prompt', t('fix_copy_prompt'), t('fix_copied'))}</button>
        <a class="small" href="https://code.claude.com/docs/en/cli-reference" target="_blank" rel="noopener noreferrer">{t('fix_cli_doc')} ↗</a>
      </div>
      {#if link}<p class="small muted">{t('fix_open_note')} <a href="https://code.claude.com/docs/en/deep-links" target="_blank" rel="noopener noreferrer">{t('fix_deeplink_doc')} ↗</a></p>{/if}
    </div>
  {/if}
</div>
