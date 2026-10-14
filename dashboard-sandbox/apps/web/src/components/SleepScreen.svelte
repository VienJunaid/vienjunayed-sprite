<script lang="ts">
  import { fade } from 'svelte/transition'
  import { currentPeriod, nextPrayer, PRAYER_NAMES } from '../lib/prayerClock'
  import { recitation } from '../lib/recitation.svelte'
  import { formatTime } from '../lib/timeFormat'
  import { view } from '../lib/viewState.svelte'
  import PixelTitle from './PixelTitle.svelte'

  /**
   * Sleep mode, from Settings: pitch black, the scene paused and every widget unmounted (App), and
   * only the time as a shining pixel title with the next prayer under it (and the surah, while the
   * Quran player is on). It re-assembles each minute somewhere else on the screen, so nothing burns
   * in. Tap anywhere (or Esc) to wake.
   */
  let now = $state(new Date())
  let spot = $state({ x: 0, y: 0 })

  $effect(() => {
    // Tick on the minute, not every second: the title only changes once a minute
    let id: ReturnType<typeof setTimeout>
    const tick = () => {
      now = new Date()
      // Drift around the middle of the screen (fractions of its width and height), never off it
      spot = { x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.4 }
      id = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    id = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    return () => clearTimeout(id)
  })

  let time = $derived(formatTime(now))
  let subtitle = $derived.by(() => {
    const period = currentPeriod(now)
    if (period && now.getTime() - period.start.getTime() < 12 * 60_000) return `TIME FOR ${PRAYER_NAMES[period.prayer].en}`
    const next = nextPrayer(now)
    if (!next) return ''
    const mins = Math.max(0, Math.round((next.time.getTime() - now.getTime()) / 60_000))
    const left = mins >= 60 ? `${Math.floor(mins / 60)}H ${mins % 60}M` : `${mins} MIN`
    return `${PRAYER_NAMES[next.prayer].en} ${formatTime(next.time)} · IN ${left}`
  })

  // The Quran player keeps going while the screen sleeps: one quiet line says which surah
  let reciting = $derived(recitation.now?.status === 'playing' ? `QURAN · ${recitation.now.verse?.surah.englishName ?? ''}` : '')

  const wake = () => (view.sleeping = false)
</script>

<!-- The whole screen is the wake button -->
<button class="sleep" onclick={wake} aria-label="Wake the dashboard" transition:fade={{ duration: 600 }}>
  <div class="title" style:translate="{spot.x * 100}vw {spot.y * 100}vh">
    <!-- Two shining titles: the time big, the prayer line smaller (as one title's subtitle, it was
         scaled up with the time and ran off the screen) -->
    <div class="line">
      {#key time}<PixelTitle text={time} subtitle="" label={time} scale={2} maxWidth={innerWidth * 0.6} />{/key}
    </div>
    <div class="line">
      {#key subtitle}<PixelTitle text={subtitle} subtitle="" label={subtitle} scale={0.6} maxWidth={innerWidth * 0.6} />{/key}
    </div>
    {#if reciting}
      <div class="line">
        {#key reciting}<PixelTitle text={reciting} subtitle="" label={reciting} scale={0.6} maxWidth={innerWidth * 0.6} />{/key}
      </div>
    {/if}
  </div>
</button>

<style>
  .sleep {
    all: unset;
    position: absolute; inset: 0; z-index: 40;
    background: #000;
    display: grid; place-items: center;
    cursor: none;
  }
  .title { display: grid; justify-items: center; gap: 1.5vh; }
  /* The previous minute's title fades out in the same spot as the new one flies in */
  .line { display: grid; place-items: center; }
  .line > :global(*) { grid-area: 1 / 1; }
  /* No dark glow box behind the title on pure black */
  .title :global(.wrap) { background: none; }
</style>
