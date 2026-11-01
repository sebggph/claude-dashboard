<script>
  // Memory files Claude Code loads for this session (CLAUDE.md, rules, imports, auto memory).
  import Icon from './Icon.svelte';
  import Explain from './Explain.svelte';
  import { t } from '#lib/state.svelte.js';
  import { fmtK } from '#lib/rules.js';
  let { memory } = $props();
  const files = $derived(memory?.files || []);
</script>

<section class="card">
  <div class="card-head"><h2><Explain key="memory_files" label={t('mem_title')} /></h2><span class="card-sub">{t('mem_total', { t: fmtK(memory?.atStart || 0) })}</span></div>
  <p class="card-sub sub-lead">{t('mem_sub')}</p>
  {#if files.length}
    <div class="table-wrap"><table>
      <thead><tr><th>{t('mem_file')}</th><th class="r">{t('mem_lines')}</th><th class="r">{t('col_tokens')}</th><th>{t('mem_loads')}</th></tr></thead>
      <tbody>
        {#each files as f (f.path)}
          <tr>
            <td><div class="cell-title mono small" title={f.path}>{f.path}</div>
              <div class="cell-sub">{t('mem_scope_' + f.scope.replace(/[^a-z]/gi, '_'))}{f.via ? ' · ' + t('mem_via', { f: f.via.split('/').pop() }) : ''}</div></td>
            <td class="r num">{#if f.tooLong}<span class="status" style:color="var(--serious)" title={t('mem_too_long')}><Icon name="alert" small /> {f.lines}</span>{:else}{f.lines}{/if}</td>
            <td class="r num">{fmtK(f.tokens)}</td>
            <td><span class="badge" class:accent={f.loads === 'start'}>{f.loads === 'start' ? t('mem_start') : t('mem_demand')}</span></td>
          </tr>
        {/each}
      </tbody>
    </table></div>
  {:else}
    <div class="empty small">{t('mem_none')}</div>
  {/if}
  {#if memory && !memory.projectReadable}
    <p class="note"><Icon name="info" /><span>{t('mem_not_visible')}</span></p>
  {/if}
</section>
