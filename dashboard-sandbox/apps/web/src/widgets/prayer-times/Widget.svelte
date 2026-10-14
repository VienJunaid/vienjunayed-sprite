<script lang="ts">
  import Panel from '../Panel.svelte'
  import { currentPeriod, PRAYERS, type Prayer } from '../../lib/prayerClock'
  import { formatTime } from '../../lib/timeFormat'
  import { togglePrayer, view } from '../../lib/viewState.svelte'

  interface PrayerResponse {
    times: { name: string; time: string }[]
    next: { name: string; time: string }
    current: string
    timezone?: string
  }

  let data = $state<PrayerResponse>()
  let error = $state('')
  let now = $state(Date.now())

  async function load() {
    try {
      const res = await fetch('/api/prayer/today')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      data = body
      error = ''
    } catch (e) {
      error = (e as Error).message
    }
  }

  $effect(() => {
    load()
    const tick = setInterval(() => {
      now = Date.now()
      // Refresh just after each prayer time passes so "next" advances.
      if (data && now > Date.parse(data.next.time) + 30_000) load()
    }, 1000)
    const refresh = setInterval(load, 15 * 60_000)
    return () => { clearInterval(tick); clearInterval(refresh) }
  })

  const LABELS: Record<string, string> = {
    fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
  }

  // Yellow = the prayer it really is now; light blue = the scene picked by tapping a row.
  const isPrayer = (name: string): name is Prayer => (PRAYERS as readonly string[]).includes(name)
  let live = $derived.by((): Prayer | undefined => {
    const p = currentPeriod(new Date(now))?.prayer
    if (p) return p
    if (!data) return undefined
    return data.current === 'sunrise' ? 'fajr' : data.current === 'none' ? 'isha' : isPrayer(data.current) ? data.current : undefined
  })


  let countdown = $derived.by(() => {
    if (!data) return ''
    const ms = Math.max(0, Date.parse(data.next.time) - now)
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    const s = Math.floor((ms % 60_000) / 1000)
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
  })
</script>

<Panel title="Salah" icon="☾">
  {#if error}
    <p class="error">{error}</p>
  {:else if data}
    <ul>
      {#each data.times as p (p.name)}
        {@const tappable = isPrayer(p.name)}
        {@const isLive = p.name === live}
        {@const isPicked = p.name === view.selected}
        <li class:live={isLive} class:picked={isPicked} class:dim={p.name === 'sunrise'}>
          <button
            type="button"
            disabled={!tappable}
            onclick={(e) => { e.stopPropagation(); if (isPrayer(p.name)) togglePrayer(p.name, live) }}
            aria-pressed={isPicked}
            aria-label={tappable ? `Show the ${LABELS[p.name]} scene` : undefined}
          >
            <span class="name">{LABELS[p.name]}</span>
            <span class="dots"></span>
            <span class="at">{formatTime(new Date(p.time), data.timezone)}</span>
            <span class="marker">{isPicked ? '◆' : isLive ? '◀' : ' '}</span>
          </button>
        </li>
      {/each}
    </ul>
    <p class="countdown">{LABELS[data.next.name]} in <b>{countdown}</b></p>
  {:else}
    <p class="dim">loading…</p>
  {/if}
</Panel>

<style>
  ul { list-style: none; min-width: 15rem; }
  li { line-height: 1.7; }
  button {
    all: unset;
    display: flex; align-items: baseline; gap: 0.4rem; width: 100%;
    cursor: none; border-radius: 2px; padding: 0 0.25rem; margin: 0 -0.25rem;
  }
  button:not(:disabled):active { background: color-mix(in srgb, var(--fg) 12%, transparent); }
  .dots { flex: 1; border-bottom: 1px dotted color-mix(in srgb, var(--muted) 60%, transparent); transform: translateY(-0.3em); }
  .dim { color: var(--muted); }
  /* Live prayer time */
  .live { color: #ffd166; }
  .live .name { font-weight: 700; }
  /* Scene picked by tapping (only when it differs from the live one) */
  .picked { color: #7fe3ff; }
  .picked .name { font-weight: 700; }
  .picked button { background: color-mix(in srgb, #7fe3ff 14%, transparent); }
  .marker { width: 1ch; }
  .countdown { margin-top: 0.6rem; color: var(--muted); font-size: 0.9rem; }
  .countdown b { color: var(--fg); font-weight: 600; }
  .error { color: var(--accent); max-width: 18rem; }
</style>
