<script>
  // Cheatsheet quiz: 10 questions, pick the command that does what's described.
  // Keys 1–4 answer, Enter goes on. Best score is saved in this browser.
  import Icon from './Icon.svelte';
  import { ui, t, L, store } from '#lib/state.svelte.js';
  import { makeQuiz } from '#lib/quiz.js';
  let { sections } = $props();

  let section = $state('all');
  let round = $state([]);
  let idx = $state(0);
  let picked = $state(null);
  let score = $state(0);
  let missed = $state([]);
  let done = $state(false);
  let best = $state(Number(store.get('quizBest.all', '0')));

  function start() {
    round = makeQuiz(sections, { section, count: 10 });
    idx = 0; picked = null; score = 0; missed = []; done = false;
    best = Number(store.get('quizBest.' + section, '0'));
  }
  $effect(() => { if (!round.length && sections.length) start(); });

  const q = $derived(round[idx]);
  function answer(i) {
    if (picked != null || !q) return;
    picked = i;
    if (i === q.answer) score++;
    else missed = [...missed, q];
  }
  function next() {
    if (picked == null) return;
    if (idx < round.length - 1) { idx++; picked = null; return; }
    done = true;
    if (score > best) { best = score; store.set('quizBest.' + section, String(score)); }
  }
  function onkey(e) {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (!done && /^[1-4]$/.test(e.key)) answer(+e.key - 1);
    if (e.key === 'Enter') { if (done) start(); else next(); }
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="quiz">
  <div class="toolbar quiz-bar">
    <label class="small muted" for="quiz-section">{t('qz_topic')}</label>
    <select id="quiz-section" class="input" bind:value={section} onchange={start}>
      <option value="all">{t('news_all')}</option>
      {#each sections as s (s.id)}<option value={s.id}>{L(s.title)}</option>{/each}
    </select>
    <span class="small muted">{t('qz_best', { n: best, t: round.length || 10 })}</span>
  </div>

  {#if done}
    <section class="card quiz-card">
      <span class="card-sub">{t('qz_done')}</span>
      <h2 class="quiz-score">{t('qz_score', { n: score, t: round.length })}</h2>
      <p class="muted">{score === round.length ? t('qz_perfect') : score >= round.length * 0.7 ? t('qz_good') : t('qz_keep')}</p>
      {#if missed.length}
        <h3>{t('qz_review')}</h3>
        <div class="quiz-review">
          {#each missed as m (m.item.cmd)}
            <div class="cheat-item"><code>{m.item.cmd}</code><div><div class="d">{L(m.item.desc)}</div><div class="w">{L(m.item.why)}</div>
              {#if m.item.doc}<a href={m.item.doc} target="_blank" rel="noopener noreferrer">docs ↗</a>{/if}</div></div>
          {/each}
        </div>
      {/if}
      <button class="btn primary" type="button" onclick={start}><Icon name="refresh" /> {t('qz_again')}</button>
    </section>
  {:else if q}
    <section class="card quiz-card">
      <div class="quiz-head">
        <span class="card-sub">{t('qz_question', { n: idx + 1, t: round.length })}</span>
        <span class="card-sub">{t('qz_points', { n: score })}</span>
      </div>
      <span class="track"><span style:width="{(idx / round.length) * 100}%"></span></span>
      <h2 class="quiz-q">{t('qz_which')}</h2>
      <p class="quiz-desc">“{L(q.item.desc)}”</p>
      <div class="quiz-choices" role="group" aria-label={t('qz_choices')}>
        {#each q.choices as c, i (c)}
          <button type="button" class="quiz-choice"
            class:right={picked != null && i === q.answer} class:wrong={picked === i && i !== q.answer}
            disabled={picked != null} onclick={() => answer(i)}>
            <span class="quiz-key">{i + 1}</span><code>{c}</code>
            {#if picked != null && i === q.answer}<Icon name="check" small />{/if}
          </button>
        {/each}
      </div>
      {#if picked != null}
        <div class="quiz-why" class:ok={picked === q.answer} role="status">
          <b>{picked === q.answer ? t('qz_right') : t('qz_wrong', { c: q.item.cmd })}</b>
          <span>{L(q.item.why)}</span>
          {#if q.item.doc}<a href={q.item.doc} target="_blank" rel="noopener noreferrer">{t('official_docs')} ↗</a>{/if}
        </div>
        <button class="btn primary" type="button" onclick={next}>{idx < round.length - 1 ? t('gd_next') : t('qz_finish')} →</button>
      {/if}
    </section>
  {/if}
</div>
