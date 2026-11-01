<script>
  import { goto } from '$app/navigation';
  import MiniBar from '#lib/components/MiniBar.svelte';
  import DemoBanner from '#lib/components/DemoBanner.svelte';
  import HealthBadge from '#lib/components/HealthBadge.svelte';
  import { ui, data, t } from '#lib/state.svelte.js';
  import { sessionUsage, status as budgetStatus } from '#lib/budget.js';
  import { windowFor, shortModel, ago, sessionTitle, maskProject, maskBranch, healthOf } from '#lib/rules.js';

  let query = $state('');
  let sort = $state({ key: 'end', dir: -1 });

  const list = $derived.by(() => {
    const q = query.toLowerCase();
    const k = sort.key;
    const rank = { lean: 0, okay: 1, heavy: 2 };
    const val = (s) => (k === 'context' ? s.contextTokens / windowFor(s) : k === 'health' ? rank[healthOf(s, data.sessions.memoryFiles).grade] : s[k]);
    return (data.sessions?.sessions || [])
      .filter((s) => !q || [sessionTitle(s), ui.privacy ? '' : s.project, s.model, ui.privacy ? '' : s.gitBranch].some((v) => v && v.toLowerCase().includes(q)))
      .sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; });
  });
  const cols = [
    ['title', 'col_session', ''], ['model', 'col_model', ''], ['context', 'col_context', ''], ['health', 'col_health', ''],
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
          <td><div class="cell-title" title={sessionTitle(s)}><a href="/sessions/{s.id}" class="row-link">{sessionTitle(s)}</a></div>
            <div class="cell-sub">{maskProject(s.project)}{s.gitBranch ? ' · ' + maskBranch(s.gitBranch) : ''}</div></td>
          <td><span class="badge">{shortModel(s.model)}</span></td>
          <td><MiniBar session={s} /></td>
          <td><HealthBadge grade={healthOf(s, data.sessions.memoryFiles).grade} />{#if ui.budget.session && budgetStatus(sessionUsage(s, ui.budget.unit, data.live?.pricing?.list), ui.budget.session).level === 'over'} <span class="over-tag" title={t('bud_session_over_title')}>{t('bud_over_tag')}</span>{/if}</td>
          <td class="r num">{s.userPrompts}</td>
          <td class="r num">{s.compactions}</td>
          <td class="r small muted">{ago(s.end)}</td>
        </tr>
      {:else}
        <tr><td colspan="7" class="empty">{t('no_sessions')}</td></tr>
      {/each}
    </tbody>
  </table></div>
</section>
