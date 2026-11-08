<script>
  // A ready-to-run fix: a prompt for Claude and the command that opens
  // Claude Code in the right project with it. The dashboard only shows text;
  // nothing runs until you paste it in your terminal.
  import Icon from './Icon.svelte';
  import { ui, t } from '#lib/state.svelte.js';
  import { maskProject } from '#lib/rules.js';
  import { fixCommand } from '#lib/usage.js';

  let { prompt, project = null } = $props();
  let open = $state(false);
  let copied = $state('');
  const command = $derived(fixCommand(project, prompt));

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
      <p class="small">{project ? t('fix_intro', { p: maskProject(project) }) : t('fix_intro_any')}</p>
      {#if ui.privacy}
        <p class="small muted">{t('fix_hidden')}</p>
      {:else}
        <pre class="fix-cmd">{command}</pre>
      {/if}
      <div class="fix-actions">
        <button class="btn primary" type="button" onclick={() => copy('cmd', command)}><Icon name="terminal" />{copied === 'cmd' ? t('fix_copied') : t('fix_copy_cmd')}</button>
        <button class="btn" type="button" onclick={() => copy('prompt', prompt)}>{copied === 'prompt' ? t('fix_copied') : t('fix_copy_prompt')}</button>
        <a class="small" href="https://code.claude.com/docs/en/cli-reference" target="_blank" rel="noopener noreferrer">{t('fix_cli_doc')} ↗</a>
      </div>
    </div>
  {/if}
</div>
