<script>
  let { label, value, note = '' } = $props();
</script>

<div class="card kpi">
  <span class="kpi-label">{label}</span>
  <span class="kpi-value">{value}</span>
  {#if note}<span class="kpi-note">{note}</span>{/if}
</div>
