<script lang="ts">
  import { fade, scale } from 'svelte/transition'
  import { api } from '../lib/api'
  import type { DashboardConfig } from '../lib/types'
  import { prefs, setGlass } from '../lib/prefs.svelte'
  import type { Direction } from '../lib/pages'
  import { goToSleep, pickBackground, view } from '../lib/viewState.svelte'

  /**
   * Settings, opened by tapping the clock (or the ⚙ where there is no clock). The Page / Scene row
   * is the only pointer way to change what is on screen. Scenery mode is a view switch; the toggles
   * are saved to config/dashboard.json (the dashboard then live-reloads with the new setting).
   */
  let { config, homeBackground, where, onstep }: {
    config: DashboardConfig
    homeBackground: string
    where: string
    onstep: (dir: Direction) => void
  } = $props()

  let saving = $state(false)
  const clock = $derived(config.widgets.find((w) => w.id === 'clock'))
  const hour24 = $derived(clock?.options?.hour12 === false)
  const verseOn = $derived(config.verse.enabled)
  const showCurrent = $derived(!!config.prayer.showCurrent)
  const hijriOffset = $derived(config.hijri?.offset ?? 0)

  async function save(mutate: (c: DashboardConfig) => void) {
    saving = true
    const next = structuredClone($state.snapshot(config)) as DashboardConfig
    mutate(next)
    await api.saveConfig(next)
    // The server's file watcher reloads the page with the new setting.
  }

  function toggleScenery() {
    view.selected = null
    view.settingsOpen = false
    view.scenery = !view.scenery
  }

  function openQuran() {
    view.settingsOpen = false
    view.quran = true
  }

  const close = () => (view.settingsOpen = false)
</script>

<div class="backdrop" transition:fade={{ duration: 200 }} onclick={close} role="presentation"></div>
<section class="settings panel" transition:scale={{ duration: 220, start: 0.94 }} aria-label="Settings">
  <header>⚙ Settings</header>
  <button class="close" onclick={close} aria-label="Close settings">✕</button>

  <div class="row">
    <span class="label">
      <b>{view.scenery ? 'Scene' : 'Page'}</b>
      <small>{where}</small>
    </span>
    <span class="steps">
      <button onclick={() => onstep('prev')} aria-label="Previous">◂</button>
      <button onclick={() => onstep('next')} aria-label="Next">▸</button>
    </span>
  </div>

  <button class="row action" onclick={goToSleep}>
    <span class="label">
      <b>Sleep mode</b>
      <small>Goes dark: just the time and the next prayer, and everything else paused. Tap anywhere to wake.</small>
    </span>
    <span class="go">sleep ▸</span>
  </button>

  <button class="row action" onclick={toggleScenery}>
    <span class="label">
      <b>Scenery mode</b>
      <small>Only the pixel art. Browse every scene from the Scene row above; ✕ at the bottom to return.</small>
    </span>
    <span class="go">{view.scenery ? 'leave ▸' : 'enter ▸'}</span>
  </button>

  <button class="row action" onclick={() => pickBackground(0, config.pages?.[0]?.sceneOverride)}>
    <span class="label">
      <b>Home background</b>
      <small>Now: {homeBackground}. Pick any scene, or follow the prayer times.</small>
    </span>
    <span class="go">change ▸</span>
  </button>

  <button class="row action" onclick={openQuran}>
    <span class="label">
      <b>Quran recitation</b>
      <small>Pick a surah to play; the verse box follows along, ayah by ayah. Tapping the verse box opens this too.</small>
    </span>
    <span class="go">open ▸</span>
  </button>

  <button class="row" disabled={saving} onclick={() => save((c) => {
    const w = c.widgets.find((x) => x.id === 'clock')
    if (w) w.options = { ...w.options, hour12: hour24 }
  })}>
    <span class="label"><b>24-hour time</b><small>16:30 instead of 4:30 PM everywhere: clock, Salah times, calendar and sleep screen.</small></span>
    <span class="switch" class:on={hour24}><span></span></span>
  </button>

  <button class="row" disabled={saving} onclick={() => save((c) => (c.verse.enabled = !verseOn))}>
    <span class="label"><b>Quran verse</b><small>The rotating verse at the top of the home screen.</small></span>
    <span class="switch" class:on={verseOn}><span></span></span>
  </button>

  <button class="row" disabled={saving} onclick={() => save((c) => (c.prayer.showCurrent = !showCurrent))}>
    <span class="label">
      <b>Current prayer</b>
      <small>Keep the prayer's name and time in the sky. It sits under the verse, or takes the verse's place when the verse is off.</small>
    </span>
    <span class="switch" class:on={showCurrent}><span></span></span>
  </button>

  <!-- Per device (localStorage), applied at once: no save, no reload -->
  <button class="row" onclick={() => setGlass(!prefs.glass)}>
    <span class="label">
      <b>Glass blur</b>
      <small>Frosted blur behind the boxes. For a Mac or PC: it heats the Pi. Saved on this device only.</small>
    </span>
    <span class="switch" class:on={prefs.glass}><span></span></span>
  </button>

  <div class="row">
    <span class="label">
      <b>Hijri date</b>
      <small>Move every Hijri date a day earlier or later to match Al-Farooq's moonsighting.</small>
    </span>
    <span class="steps">
      {#each [-1, 0, 1] as d (d)}
        <button class:on={hijriOffset === d} disabled={saving} onclick={() => save((c) => (c.hijri = { ...c.hijri, offset: d }))}>
          {d > 0 ? '+1' : d < 0 ? '−1' : '0'}
        </button>
      {/each}
    </span>
  </div>

  {#if saving}<p class="saving">saving…</p>{/if}
</section>

<style>
  .backdrop { position: absolute; inset: 0; background: color-mix(in srgb, var(--bg) 55%, transparent); z-index: 20; }
  .settings {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 21;
    width: min(34rem, 88vw); padding: 1.6rem 1.4rem 1.2rem;
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(4px);
    display: flex; flex-direction: column; gap: 0.6rem;
  }
  header {
    position: absolute; top: -0.7em; left: 0.9rem; padding: 0 0.5rem; background: var(--bg);
    color: var(--accent); font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase;
  }
  button { all: unset; cursor: none; }
  .close { position: absolute; top: 0.4rem; right: 0.6rem; color: var(--muted); font-size: 1rem; padding: 0.2rem 0.4rem; }
  .row {
    display: flex; align-items: center; gap: 1rem; padding: 0.7rem 0.8rem;
    border: 1px solid color-mix(in srgb, var(--muted) 45%, transparent);
  }
  .row:active { background: color-mix(in srgb, var(--accent) 15%, transparent); }
  .row:disabled { opacity: 0.5; }
  .label { flex: 1; display: flex; flex-direction: column; gap: 0.15rem; }
  .label b { color: var(--fg); font-weight: 600; }
  .label small { color: var(--muted); font-size: 0.78rem; line-height: 1.3; }
  .go { color: var(--accent); letter-spacing: 0.08em; }
  /* Pixel-style switch */
  .switch { width: 2.6rem; height: 1.2rem; border: 1px solid var(--muted); display: flex; padding: 2px; }
  .switch span { width: 50%; height: 100%; background: var(--muted); transition: transform 0.15s steps(3); }
  .switch.on { border-color: #7fe3ff; }
  .switch.on span { background: #7fe3ff; transform: translateX(100%); }
  .steps { display: flex; gap: 0.3rem; }
  .steps button { width: 2.2rem; text-align: center; padding: 0.2rem 0; border: 1px solid var(--muted); color: var(--muted); }
  .steps button.on { border-color: #7fe3ff; color: #7fe3ff; }
  .saving { color: var(--muted); font-size: 0.8rem; text-align: right; }
</style>
