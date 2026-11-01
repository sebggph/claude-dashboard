<script>
  import { t } from '#lib/state.svelte.js';
  import { fmtK } from '#lib/rules.js';
  /** bd = breakdownOf(session) */
  let { bd, height = 12, buffer = true } = $props();
</script>

<div class="stackbar" style:height="{height}px">
  {#each bd.groups as g (g.id)}
    <span style:width="{(g.tokens / bd.win) * 100}%" style:background={g.color} title="{t('grp_' + g.id)}: {fmtK(g.tokens)}"></span>
  {/each}
  {#if buffer && bd.buffer}
    <span class="buffer" style:width="{(bd.buffer / bd.win) * 100}%" style:margin-left="auto" title={t('row_buffer')}></span>
  {/if}
</div>
