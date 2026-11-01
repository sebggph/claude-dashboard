<script>
  import Icon from './Icon.svelte';
  import GuideLink from './GuideLink.svelte';
  import { t, L } from '#lib/state.svelte.js';
  import { LEVEL, REC_GUIDE } from '#lib/rules.js';
  let { rec, session = '' } = $props();
  const lv = $derived(LEVEL[rec.level]);
</script>

<div class="rec">
  <div class="rec-icon" style:color={lv.color}><Icon name={lv.icon} /></div>
  <div>
    <h3>{L(rec.def.title)}{#if session} <span class="muted small">· {session}</span>{/if}</h3>
    <p>{L(rec.def.text)}</p>
    <div class="why">{t('why_triggered', { x: rec.why })}</div>
    <div class="rec-links">
      {#if REC_GUIDE[rec.id]}<GuideLink slug={REC_GUIDE[rec.id]} />{/if}
      {#if rec.def.doc}<a href={rec.def.doc} target="_blank" rel="noopener noreferrer">{t('official_docs')} ↗</a>{/if}
    </div>
  </div>
</div>
