<script>
  import { breakdownOf, pctSmart } from '#lib/rules.js';
  let { session } = $props();
  const bd = $derived(breakdownOf(session));
</script>

<div class="minibar">
  <div class="track">
    {#each bd.groups as g (g.id)}<span style:width="{(g.tokens / bd.win) * 100}%" style:background={g.color}></span>{/each}
  </div>
  <span class="pct">{pctSmart(bd.used / bd.win)}</span>
</div>
