<script>
  import { icon } from '#lib/icons.js';
  let { name, small = false } = $props();
</script>

{@html icon(name, small ? 'icon icon-sm' : 'icon')}
