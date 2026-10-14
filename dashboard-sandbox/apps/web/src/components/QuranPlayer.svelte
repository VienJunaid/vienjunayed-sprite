<script lang="ts">
  import { tick } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import { PRAYER_NAMES, type Prayer } from '../lib/prayerClock'
  import { recitation, recite, surahs as loadSurahs, type SurahInfo } from '../lib/recitation.svelte'
  import { formatTime } from '../lib/timeFormat'
  import { view } from '../lib/viewState.svelte'
  import PixelTitle from './PixelTitle.svelte'

  /**
   * The Quran player, opened by tapping the verse box (or from Settings): all 114 surahs, and the
   * controls. Tap a surah to play it from the start. This is only the remote: the server plays the
   * audio (services/recitation.ts), so closing this, changing pages or a live reload doesn't stop it.
   */
  let list = $state<SurahInfo[]>([])
  let reciter = $state('')
  let failed = $state('')
  let width = $state(0)
  let listEl = $state<HTMLOListElement>()

  const player = $derived(recitation.now)
  const current = $derived(list.find((s) => s.number === player?.surah))
  const active = $derived(!!player && player.status !== 'idle')

  $effect(() => {
    loadSurahs()
      .then(async (data) => {
        list = data.surahs
        reciter = data.reciter
        await tick()
        listEl?.querySelector('.on')?.scrollIntoView({ block: 'center' })
      })
      .catch((e: Error) => (failed = e.message))
  })

  const length = (seconds: number) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
  }
  const place = $derived(player && player.ayah > 0 ? `ayah ${player.ayah} of ${player.ayahs}` : 'the opening')
  const prayerName = $derived(player?.hold ? (PRAYER_NAMES[player.hold.prayer as Prayer]?.en ?? 'prayer') : '')

  const close = () => (view.quran = false)
</script>

<div class="backdrop" transition:fade={{ duration: 200 }} onclick={close} role="presentation"></div>
<section class="quran panel" transition:scale={{ duration: 220, start: 0.94 }} aria-label="Quran player" bind:clientWidth={width}>
  <header>۞ Quran{reciter ? ` · ${reciter}` : ''}</header>
  <button class="close" onclick={close} aria-label="Close the Quran player">✕</button>

  <div class="title">
    {#if current && width}
      {#key current.number}
        <PixelTitle text={current.name} subtitle="{current.englishName} · {current.translatedName}" label={current.englishName} maxWidth={width * 0.9} />
      {/key}
    {:else if !player?.surah}
      <p class="hint">Pick a surah and it plays. The verse box follows along, ayah by ayah.</p>
    {/if}
  </div>

  {#if player}
    <p class="status" class:warn={!player.available || !!player.error}>
      {#if !player.available}
        No audio player on this machine yet. Install mpv (on the Pi: sudo apt install mpv).
      {:else if player.error}
        {player.error}
      {:else if player.status === 'loading'}
        Loading…
      {:else if player.status === 'playing'}
        Reciting <b>{place}</b>
      {:else if player.status === 'prayer' && player.hold}
        Paused for <b>{prayerName}</b>. It picks up again at {formatTime(new Date(player.hold.until))}.
        <button class="link" onclick={() => recite.resume(true)}>Play now ▸</button>
      {:else if player.status === 'paused'}
        Paused at <b>{place}</b>
      {:else if current}
        Stopped at <b>{place}</b>
      {/if}
    </p>

    <div class="controls">
      <span class="steps">
        {#if player.status === 'playing' || player.status === 'loading' || player.status === 'prayer'}
          <button class="wide" onclick={() => recite.pause()}>▮▮ Pause</button>
        {:else}
          <button class="wide" disabled={!player.surah || !player.available} onclick={() => recite.resume()}>▶ {active ? 'Play' : 'Resume'}</button>
        {/if}
        <button class="wide" disabled={!active} onclick={() => recite.stop()}>■ Stop</button>
      </span>
      <span class="steps" aria-label="At the end of the surah">
        <button class="wide" class:on={player.mode === 'continue'} onclick={() => recite.mode('continue')}>Continue</button>
        <button class="wide" class:on={player.mode === 'loop'} onclick={() => recite.mode('loop')}>Loop surah</button>
      </span>
      <span class="steps" aria-label="Volume">
        <button disabled={player.volume <= 0} onclick={() => recite.volume(player.volume - 10)} aria-label="Quieter">−</button>
        <span class="volume">vol {player.volume}</span>
        <button disabled={player.volume >= 100} onclick={() => recite.volume(player.volume + 10)} aria-label="Louder">+</button>
      </span>
    </div>
  {/if}

  {#if failed}<p class="status warn">Could not load the surah list ({failed}).</p>{/if}
  <ol class="surahs" bind:this={listEl}>
    {#each list as s (s.number)}
      <li>
        <button class="surah" class:on={s.number === player?.surah} disabled={player ? !player.available : false} onclick={() => recite.play(s.number)}>
          <span class="num">{s.number}</span>
          <span class="names">
            <b>{s.englishName}</b>
            <small>{s.translatedName} · {s.ayahs} ayat · {length(s.seconds)}{s.saved ? ' · saved' : ''}</small>
          </span>
          <span class="ar" lang="ar" dir="rtl">{s.name}</span>
        </button>
      </li>
    {/each}
  </ol>
</section>

<style>
  .backdrop { position: absolute; inset: 0; background: color-mix(in srgb, var(--bg) 55%, transparent); z-index: 20; }
  .quran {
    position: absolute; left: 50%; top: 3.5vh; bottom: 3.5vh; transform: translateX(-50%); z-index: 21;
    width: min(58rem, 92vw); padding: 1.6rem 1.4rem 1.2rem;
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(4px);
    display: flex; flex-direction: column; gap: 0.7rem;
  }
  header {
    position: absolute; top: -0.7em; left: 0.9rem; padding: 0 0.5rem; background: var(--bg);
    color: var(--accent); font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase;
  }
  button { all: unset; cursor: none; }
  .close { position: absolute; top: 0.4rem; right: 0.6rem; color: var(--muted); font-size: 1rem; padding: 0.2rem 0.4rem; }
  .title { display: flex; justify-content: center; align-items: center; min-height: 5.5rem; }
  .hint { color: var(--muted); font-size: 0.9rem; text-align: center; }
  .status { text-align: center; color: var(--muted); font-size: 0.9rem; min-height: 1.3em; }
  .status b { color: var(--fg); font-weight: 600; }
  .status.warn { color: #ffd166; }
  .link { color: #7fe3ff; margin-left: 0.6rem; padding: 0.1rem 0.3rem; }

  .controls { display: flex; justify-content: center; flex-wrap: wrap; gap: 0.6rem 1.6rem; }
  .steps { display: flex; align-items: center; gap: 0.3rem; }
  .steps button { min-width: 2.2rem; text-align: center; padding: 0.35rem 0; border: 1px solid var(--muted); color: var(--fg); }
  .steps button.wide { padding: 0.35rem 0.9rem; }
  .steps button.on { border-color: #7fe3ff; color: #7fe3ff; }
  .steps button:active { background: color-mix(in srgb, var(--accent) 15%, transparent); }
  .steps button:disabled { opacity: 0.35; }
  .volume { min-width: 4.2rem; text-align: center; color: var(--muted); font-size: 0.85rem; }

  /* Only the list scrolls: overflow on the box itself would clip the title cut into its border */
  .surahs {
    list-style: none; flex: 1; min-height: 0; overflow-y: auto;
    display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; align-content: start;
    scrollbar-width: thin; scrollbar-color: var(--muted) transparent;
  }
  .surah {
    display: flex; align-items: center; gap: 0.7rem; padding: 0.45rem 0.7rem;
    width: 100%; box-sizing: border-box;
    border: 1px solid color-mix(in srgb, var(--muted) 45%, transparent);
  }
  .surah:active { background: color-mix(in srgb, var(--accent) 15%, transparent); }
  .surah:disabled { opacity: 0.5; }
  .num { width: 1.9rem; text-align: right; color: var(--muted); font-size: 0.85rem; }
  .names { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
  .names b { color: var(--fg); font-weight: 600; }
  .names small { color: var(--muted); font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ar { font-family: var(--font-arabic); font-size: 1.05rem; color: var(--accent); line-height: 1.2; white-space: nowrap; }
  .surah.on { border-color: #7fe3ff; background: color-mix(in srgb, #7fe3ff 10%, transparent); }
  .surah.on .names b, .surah.on .num { color: #7fe3ff; }
  .surah.on .num::before { content: '◆ '; }
  .surah.on .num { width: auto; }
</style>
