<script lang="ts">
  import { fade } from 'svelte/transition'
  import { PRAYER_NAMES, type Prayer } from '../../lib/prayerClock'
  import { recitation, type RecitedVerse } from '../../lib/recitation.svelte'
  import { formatTime } from '../../lib/timeFormat'
  import { view } from '../../lib/viewState.svelte'

  /**
   * The verse box. Normally it rotates the uplifting daily verses; while the Quran player is on
   * (lib/recitation.svelte.ts), it shows the exact ayah being recited instead. Tap it to open the
   * player.
   */
  let { rotateMinutes = 30, daily = true }: {
    rotateMinutes?: number
    /** Rotate the daily verses. Off when only the recitation is shown (the verse setting is off). */
    daily?: boolean
  } = $props()
  let verse = $state<RecitedVerse>()

  async function load() {
    try {
      const res = await fetch('/api/quran/random')
      if (res.ok) verse = await res.json()
    } catch {
      /* keep the current verse */
    }
  }

  $effect(() => {
    if (!daily) return
    load()
    const id = setInterval(load, Math.max(1, rotateMinutes) * 60_000)
    return () => clearInterval(id)
  })

  let live = $derived(recitation.now && recitation.now.status !== 'idle' ? recitation.now : null)
  let shown = $derived(live?.verse ?? (daily ? verse : undefined))

  // The daily verses are all short. An ayah being recited can be a whole page (Al-Baqarah 282), so
  // its text shrinks to keep the box in its place.
  const fit = (length: number, comfortable: number, smallest: number) =>
    Math.max(smallest, Math.min(1, Math.sqrt(comfortable / length)))

  let caption = $derived.by(() => {
    if (!shown) return ''
    const where = `${shown.surah.englishName} · ${shown.ayah > 0 ? shown.key : shown.surah.translatedName}`
    if (!live) return `— ${where}`
    if (live.status === 'paused') return `▮▮ ${where} · paused`
    if (live.status === 'prayer' && live.hold) {
      return `▮▮ ${where} · paused for ${PRAYER_NAMES[live.hold.prayer as Prayer]?.en ?? 'prayer'} until ${formatTime(new Date(live.hold.until))}`
    }
    return `▶ ${where}`
  })

  const arabicDigits = (n: number) => n.toLocaleString('ar-EG', { useGrouping: false })
</script>

<!-- Old and new verses share one grid cell so they crossfade in place -->
<div class="stack">
  <button class="open" onclick={() => (view.quran = true)} aria-label="Open the Quran player"></button>
{#if shown}
  {#key shown.key}
    <figure
      style:--fit={live ? fit(shown.arabic.length, 110, 0.4) : 1}
      style:--tfit={live ? fit(shown.translation.length, 150, 0.6) : 1}
      transition:fade={{ duration: live ? 400 : 1500 }}
    >
      <span class="ornament" aria-hidden="true">۞</span>
      {#if shown.bismillah}
        <p class="bismillah" lang="ar" dir="rtl">{shown.bismillah}</p>
      {/if}
      <blockquote lang="ar" dir="rtl">{shown.arabic}{#if shown.ayah > 0}&nbsp;<span class="ayah">{'۝' + arabicDigits(shown.ayah)}</span>{/if}</blockquote>
      <p class="translation">{shown.ayah > 0 ? `“${shown.translation}”` : shown.translation}</p>
      <figcaption>{caption}</figcaption>
    </figure>
  {/key}
{/if}
</div>

<style>
  .stack { position: relative; display: grid; justify-items: center; max-width: min(100%, 60rem); }
  /* The whole box is the button: it lies over the verse, which stays plain text underneath */
  .open { all: unset; position: absolute; inset: 0; z-index: 1; cursor: none; }
  .open:active ~ figure { border-color: var(--accent); }
  /* Glass blur setting (lib/prefs.svelte.ts): frosted, for machines with GPU to spare */
  :global(html.glass) figure { background: color-mix(in srgb, var(--bg) 68%, transparent); backdrop-filter: blur(4px); }
  figure {
    grid-area: 1 / 1;
    position: relative;
    width: fit-content;
    max-width: 100%;
    text-align: center;
    color: var(--verse);
    padding: 1.4rem 2.6rem 1.1rem;
    /* A see-through panel so the verse reads over any background. No backdrop blur: it would be
       redone every frame over the animated scene (see Panel.svelte). */
    background: color-mix(in srgb, var(--bg) 76%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--bg) 25%, transparent), 0 8px 32px color-mix(in srgb, var(--bg) 50%, transparent);
    text-shadow: 0 1px 6px var(--bg);
  }
  .ornament {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translate(-50%, -55%);
    padding: 0 0.6rem;
    font-family: var(--font-arabic);
    font-size: 1.4rem;
    line-height: 1;
    color: var(--accent);
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    text-shadow: none;
  }
  .bismillah { font-family: var(--font-arabic); font-size: clamp(1rem, 1.8vw, 1.7rem); opacity: 0.75; margin-bottom: 0.4rem; }
  blockquote {
    font-family: var(--font-arabic);
    font-size: calc(clamp(1.6rem, 3vw, 3.2rem) * var(--fit, 1));
    line-height: 1.75;
  }
  .ayah { font-size: 0.8em; white-space: nowrap; }
  .translation { margin-top: 0.8rem; font-size: calc(clamp(0.9rem, 1.25vw, 1.3rem) * var(--tfit, 1)); line-height: 1.5; opacity: 0.92; }
  /* Short screens: smaller text so the panel doesn't take over the scene. */
  @media (max-height: 600px) {
    figure { padding: 0.9rem 1.4rem 0.7rem; }
    blockquote { font-size: calc(1.4rem * var(--fit, 1)); line-height: 1.6; }
    .translation { font-size: calc(0.8rem * var(--tfit, 1)); }
  }
  figcaption { margin-top: 0.6rem; font-size: 0.85rem; color: var(--accent); letter-spacing: 0.05em; }
</style>
