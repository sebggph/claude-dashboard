<script>
  // MCP servers in this session: tools, definitions loaded into context, use.
  import Icon from './Icon.svelte';
  import Explain from './Explain.svelte';
  import { t } from '#lib/state.svelte.js';
  import { fmtK } from '#lib/rules.js';
  let { mcp } = $props();
  const servers = $derived(mcp?.servers || []);
  const issues = $derived(mcp?.issues || []);
  const count = (st) => issues.filter((i) => i.status === st).length;
</script>

<section class="card">
  <div class="card-head"><h2><Explain key="mcp_tools" label={t('mcp_title')} /></h2><span class="card-sub">{t('mcp_total', { t: fmtK(mcp?.loadedTokens || 0) })}</span></div>
  <p class="card-sub sub-lead">{t('mcp_sub')}</p>
  {#if servers.length}
    <div class="table-wrap"><table>
      <thead><tr><th>{t('mcp_server')}</th><th class="r">{t('mcp_tools')}</th><th class="r">{t('mcp_defs')}</th><th class="r">{t('col_calls')}</th></tr></thead>
      <tbody>
        {#each servers as m (m.name)}
          <tr>
            <td><div class="cell-title">{m.name}</div>
              {#if m.instructionsTokens}<div class="cell-sub">{t('mcp_instr', { t: fmtK(m.instructionsTokens) })}</div>{/if}</td>
            <td class="r num" title={t('mcp_loaded_hint')}>{m.loadedTools}/{m.tools}</td>
            <td class="r num">{fmtK(m.loadedTokens)}</td>
            <td class="r num">{m.calls || '–'}</td>
          </tr>
        {/each}
      </tbody>
    </table></div>
  {:else}
    <div class="empty small">{t('mcp_none')}</div>
  {/if}
  {#if issues.length}
    <details class="issues">
      <summary><Icon name="alert" small /> {t('mcp_issues', { n: issues.length, f: count('failed'), a: count('needs_auth'), p: count('pending') })}</summary>
      <ul>{#each issues as i (i.name)}<li><span class="mono small">{i.name}</span> · {t('mcp_st_' + i.status)}{i.error ? ` (${i.error})` : ''}</li>{/each}</ul>
      <p class="small muted">{t('mcp_issues_tip')}</p>
    </details>
  {/if}
</section>
