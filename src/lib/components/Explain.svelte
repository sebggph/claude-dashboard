<script>
  // A label that opens the explanation drawer for a context category.
  import { ui } from '#lib/state.svelte.js';
  let { key, label } = $props();
</script>

<button class="lbl" type="button" onclick={() => (ui.drawer = { key, label })}>{label}</button>
