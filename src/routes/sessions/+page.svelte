<script>
  import { goto } from '$app/navigation';
  import MiniBar from '#lib/components/MiniBar.svelte';
  import DemoBanner from '#lib/components/DemoBanner.svelte';
  import { data, t } from '#lib/state.svelte.js';
  import { windowFor, shortModel, projectName, ago } from '#lib/rules.js';

  let query = $state('');
  let sort = $state({ key: 'end', dir: -1 });

  const list = $derived.by(() => {
    const q = query.toLowerCase();
    const k = sort.key;
    const val = (s) => (k === 'context' ? s.contextTokens / windowFor(s) : s[k]);
    return (data.sessions?.sessions || [])
      .filter((s) => !q || [s.title, s.project, s.model, s.gitBranch].some((v) => v && v.toLowerCase().includes(q)))
      .sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; });
  });
  const cols = [
    ['title', 'col_session', ''], ['model', 'col_model', ''], ['context', 'col_context', ''],
    ['userPrompts', 'col_prompts', 'r'], ['compactions', 'col_compact', 'r'], ['end', 'col_last', 'r'],
  ];
  const sortBy = (k) => (sort = { key: k, dir: sort.key === k ? -sort.dir : -1 });
</script>

<DemoBanner />
<div class="page-head">
  <div><h1>{t('ss_title')}</h1><p>{t('ss_sub')}</p></div>
  <input class="input" type="search" placeholder={t('search_sessions')} aria-label={t('search_sessions')} bind:value={query} />
</div>
<section class="card">
  <div class="table-wrap"><table>
    <thead><tr>
      {#each cols as [key, label, cls] (key)}
        <th class={cls}><button type="button" onclick={() => sortBy(key)}>{t(label)}{sort.key === key ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}</button></th>
      {/each}
    </tr></thead>
    <tbody>
      {#each list as s (s.id)}
        <tr class="link" tabindex="0" onclick={() => goto(`/sessions/${s.id}`)} onkeydown={(e) => e.key === 'Enter' && goto(`/sessions/${s.id}`)}>
          <td><div class="cell-title" title={s.title}><a href="/sessions/{s.id}" class="row-link">{s.title || s.id}</a></div>
            <div class="cell-sub">{projectName(s.project)}{s.gitBranch ? ' · ' + s.gitBranch : ''}</div></td>
          <td><span class="badge">{shortModel(s.model)}</span></td>
          <td><MiniBar session={s} /></td>
          <td class="r num">{s.userPrompts}</td>
          <td class="r num">{s.compactions}</td>
          <td class="r small muted">{ago(s.end)}</td>
        </tr>
      {:else}
        <tr><td colspan="6" class="empty">{t('no_sessions')}</td></tr>
      {/each}
    </tbody>
  </table></div>
</section>
