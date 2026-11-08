<script>
  // A ready-to-run fix: a prompt for Claude, a link that opens Claude Code in
  // the right project with the prompt typed in, and the same as a command.
  // Nothing is sent until you press Enter in Claude Code.
  import Icon from './Icon.svelte';
  import { ui, t } from '#lib/state.svelte.js';
  import { maskProject } from '#lib/rules.js';
  import { fixCommand, deepLink } from '#lib/usage.js';
  import { STATIC_DEMO } from '#lib/paths.js';

  let { prompt, project = null } = $props();
  let open = $state(false);
  let copied = $state('');
  const command = $derived(fixCommand(project, prompt));
  // One click: a terminal opens with Claude Code in the project and the prompt typed in.
  // Not in the online demo (its project folders don't exist on your computer).
  const link = $derived(STATIC_DEMO ? null : deepLink(project, prompt));

  async function copy(what, text) {
    try { await navigator.clipboard.writeText(text); copied = what; setTimeout(() => (copied = ''), 1500); } catch { /* clipboard blocked */ }
  }
</script>

<div class="fix">
  <button class="btn" type="button" aria-expanded={open} onclick={() => (open = !open)}>
    <Icon name="wrench" />{open ? t('fix_hide') : t('fix_btn')}
  </button>
  {#if open}
    <div class="fix-panel">
      <p class="small">{link ? t('fix_open_intro', { p: maskProject(project) }) : project ? t('fix_intro', { p: maskProject(project) }) : t('fix_intro_any')}</p>
      {#if ui.privacy}
        <p class="small muted">{t('fix_hidden')}</p>
      {:else}
        <pre class="fix-cmd">{command}</pre>
      {/if}
      <div class="fix-actions">
        {#if link}
          <!-- Also copies the command, as a backup if the link doesn't open. -->
          <a class="btn primary" href={link} onclick={() => copy('open', command)}><Icon name="terminal" />{copied === 'open' ? t('fix_opening') : t('fix_open')}</a>
        {/if}
        <button class="btn" class:primary={!link} type="button" onclick={() => copy('cmd', command)}>{#if !link}<Icon name="terminal" />{/if}{copied === 'cmd' ? t('fix_copied') : t('fix_copy_cmd')}</button>
        <button class="btn" type="button" onclick={() => copy('prompt', prompt)}>{copied === 'prompt' ? t('fix_copied') : t('fix_copy_prompt')}</button>
        <a class="small" href="https://code.claude.com/docs/en/cli-reference" target="_blank" rel="noopener noreferrer">{t('fix_cli_doc')} ↗</a>
      </div>
      {#if link}<p class="small muted">{t('fix_open_note')} <a href="https://code.claude.com/docs/en/deep-links" target="_blank" rel="noopener noreferrer">{t('fix_deeplink_doc')} ↗</a></p>{/if}
    </div>
  {/if}
</div>
