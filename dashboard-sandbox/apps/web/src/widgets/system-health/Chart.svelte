<script lang="ts">
  /**
   * A pixel bar chart of recent history: one column per time bucket, newest on the right, heights
   * snapped to steps so it reads as blocks rather than a smooth graph. Missing history is empty.
   * It stretches to its container's width.
   */
  let { values, min, max, color = 'var(--accent)', columns = 60, steps = 10 }: {
    values: (number | null)[]
    /** Fixed scale; omitted → fitted to the data (with a little headroom). */
    min?: number
    max?: number
    color?: string | ((v: number) => string)
    columns?: number
    steps?: number
  } = $props()

  let bars = $derived.by(() => {
    const per = Math.max(1, Math.ceil(values.length / columns))
    const out: (number | null)[] = []
    for (let end = values.length; end > 0 && out.length < columns; end -= per) {
      const vs = values.slice(Math.max(0, end - per), end).filter((v): v is number => v !== null)
      out.unshift(vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null)
    }
    while (out.length < columns) out.unshift(null)
    const real = out.filter((v): v is number => v !== null)
    const pad = real.length ? (Math.max(...real) - Math.min(...real)) * 0.15 + 1 : 1
    const lo = min ?? (real.length ? Math.min(...real) - pad : 0)
    const hi = max ?? (real.length ? Math.max(...real) + pad : 1)
    return out.map((v) => (v === null ? null : { v, h: Math.max(1, Math.round(((v - lo) / (hi - lo || 1)) * steps)) / steps }))
  })
</script>

<div class="chart" style:--cols={columns}>
  {#each bars as b, i (i)}
    <span style:height={b ? `${b.h * 100}%` : '0'} style:background={b ? (typeof color === 'function' ? color(b.v) : color) : 'none'}></span>
  {/each}
</div>

<style>
  .chart {
    height: 100%; min-height: 2.5rem;
    display: grid; grid-template-columns: repeat(var(--cols), 1fr); align-items: end; gap: 2px;
    border-bottom: 1px solid color-mix(in srgb, var(--muted) 50%, transparent);
  }
  span { display: block; opacity: 0.9; }
</style>
