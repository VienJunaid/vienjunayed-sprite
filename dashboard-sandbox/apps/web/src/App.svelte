<script lang="ts">
  import { fade } from 'svelte/transition'
  import { api, watchForReload } from './lib/api'
  import { onNavigate, type Direction } from './lib/pages'
  import { setHijriOffset } from './lib/hijri'
  import { prefs } from './lib/prefs.svelte'
  import { currentPeriod, forceBanner, PRAYER_NAMES, PRAYERS, setPrayerData, type Period, type Prayer } from './lib/prayerClock'
  import { recitation, watchRecitation } from './lib/recitation.svelte'
  import { applyTheme } from './lib/theme'
  import { formatTime, setHour12 } from './lib/timeFormat'
  import { pickBackground, view } from './lib/viewState.svelte'
  import type { Area, CharacterAsset, DashboardConfig, PageConfig, SceneConfig, WidgetConfig } from './lib/types'
  import AsciiScene from './components/AsciiScene.svelte'
  import BackgroundPicker, { pretty } from './components/BackgroundPicker.svelte'
  import PixelTitle from './components/PixelTitle.svelte'
  import QuranPlayer from './components/QuranPlayer.svelte'
  import Settings from './components/Settings.svelte'
  import SleepScreen from './components/SleepScreen.svelte'
  import type { LoadedPage } from './scene/scene'
  import Verse from './widgets/quran-verse/Verse.svelte'
  import { widgets } from './widgets/registry'

  // Layer stack, back to front: pixel/ASCII canvas → widgets (verse + prayer banner in the top row).

  /** Each page shows one scene, or one scene per prayer period (index into `scenes`). */
  type PageScenes = number | Partial<Record<Prayer, number>>

  let config = $state<DashboardConfig>()
  let pageConfigs = $state<PageConfig[]>([])
  let scenes = $state<LoadedPage[]>()
  let pageScenes = $state<PageScenes[]>([])
  /** Scenery mode: every scene in order (prayer scenes, pages, then the rest), and where we are. */
  let gallery = $state<number[]>([])
  /** Scene name of each entry in `scenes` ('' for inline scenes), for background choices. */
  let sceneNames = $state<string[]>([])
  let galleryIndex = $state(0)
  let page = $state(0)
  // Come back to the same page after a live reload (e.g. saving a background from page 3). Read it
  // now, before the effect below records page 0 over it.
  const restorePage = (() => {
    try { return Number(sessionStorage.getItem('dashboard:page')) || 0 } catch { return 0 }
  })()
  let dir = $state<1 | -1>(1)
  let period = $state<Period>()
  let now = $state(Date.now())
  let error = $state('')

  async function loadScene(cfg: DashboardConfig, ref: SceneConfig | string): Promise<LoadedPage> {
    const scene = typeof ref === 'string' ? await api.scene(ref) : ref
    const [theme, background, characters] = await Promise.all([
      api.theme(scene.theme ?? cfg.theme),
      scene.background ? api.background(scene.background).catch(() => undefined) : undefined,
      Promise.all(
        [...new Set(scene.characters.map((c) => c.asset))].map((name) =>
          api.character(name).then((a): [string, CharacterAsset] => [name, a]).catch(() => undefined),
        ),
      ),
    ])
    return { scene, theme, assets: { background, characters: new Map(characters.filter((c) => c !== undefined)) } }
  }

  async function load() {
    const cfg = await api.config()
    const pcs: PageConfig[] = cfg.pages?.length ? cfg.pages : [{ scene: cfg.scene, widgets: true, verse: true }]
    const refs: (SceneConfig | string)[] = []
    const mapping: PageScenes[] = pcs.map((pc) => {
      if (pc.sceneByPrayer) {
        const m: Partial<Record<Prayer, number>> = {}
        for (const p of PRAYERS) if (pc.sceneByPrayer[p]) m[p] = refs.push(pc.sceneByPrayer[p]!) - 1
        return m
      }
      return refs.push(pc.scene!) - 1
    })
    // Scenery mode browses every scene in config/scenes, not only the ones on pages
    const allNames = await api.sceneList().catch(() => [] as string[])
    for (const name of allNames) if (!refs.includes(name)) refs.push(name)
    const loaded = await Promise.all(refs.map((r) => loadScene(cfg, r)))
    await refreshPrayers()
    // The canvas atlas needs the monospace font loaded before it draws glyphs.
    await document.fonts.load(`16px "JetBrains Mono"`).catch(() => {})
    setHijriOffset(cfg.hijri?.offset)
    config = cfg
    pageConfigs = pcs
    pageScenes = mapping
    const order: number[] = []
    for (const m of mapping) {
      for (const i of typeof m === 'number' ? [m] : PRAYERS.map((p) => m[p]).filter((i) => i !== undefined)) if (!order.includes(i)) order.push(i)
    }
    for (let i = 0; i < refs.length; i++) if (!order.includes(i)) order.push(i)
    gallery = order
    sceneNames = refs.map((r) => (typeof r === 'string' ? r : ''))
    // One 12/24-hour setting for every time on screen (stored as the clock's option)
    setHour12(cfg.widgets.find((w) => w.id === 'clock')?.options?.hour12 !== false)
    scenes = loaded
    if (restorePage > 0 && restorePage < pcs.length) page = restorePage
    // Preview a scene directly: ?scene=<name> opens scenery mode on it
    const want = new URLSearchParams(location.search).get('scene')
    if (want && refs.includes(want)) {
      view.scenery = true
      queueMicrotask(() => (galleryIndex = Math.max(0, gallery.indexOf(refs.indexOf(want)))))
    }
  }

  async function refreshPrayers() {
    try {
      const res = await fetch('/api/prayer/today')
      if (res.ok) setPrayerData(await res.json())
    } catch {
      /* keep what we have */
    }
    period = currentPeriod()
  }

  $effect(() => {
    load().catch((e) => (error = (e as Error).message))
    const tick = setInterval(() => {
      now = Date.now()
      const p = currentPeriod()
      if (p?.prayer !== period?.prayer) {
        dir = 1
        period = p
        view.selected = null // a new prayer time brings the home screen back to live
      }
    }, 20_000)
    const refresh = setInterval(refreshPrayers, 30 * 60_000)
    const stopReload = watchForReload(
      view.wallpaper
        ? (p) => {
            if (!pageConfigs.length || p < 0 || p >= pageConfigs.length || p === page) return
            dir = p > page ? 1 : -1
            page = p
          }
        : undefined,
    )
    const stopRecitation = watchRecitation()
    return () => { clearInterval(tick); clearInterval(refresh); stopReload(); stopRecitation() }
  })

  /** Which scene is on screen: the page's scene, or its scene for the current prayer. */
  function sceneFor(p: number): number {
    // Previewing in the background picker, then the saved choice, then the page's own scene
    const pick = (view.picking === p ? view.preview : null) ?? (view.picking === p ? null : pageConfigs[p]?.sceneOverride)
    const named = pick ? sceneNames.indexOf(pick) : -1
    // On the home page, a prayer tapped in the Salah box still previews that prayer's scene
    if (named >= 0 && !(view.selected && pageScenes[p] && typeof pageScenes[p] !== 'number')) return named
    const m = pageScenes[p]
    if (typeof m === 'number') return m
    const byPrayer = m?.[view.selected ?? period?.prayer ?? 'isha'] ?? Object.values(m ?? {})[0]
    return byPrayer ?? 0
  }
  $effect(() => {
    try { sessionStorage.setItem('dashboard:page', String(page)) } catch { /* ignore */ }
  })
  $effect(() => {
    try { sessionStorage.setItem('dashboard:sleep', view.sleeping ? '1' : '0') } catch { /* ignore */ }
  })
  // Glass blur (per device): the boxes' CSS switches on `html.glass`
  $effect(() => { document.documentElement.classList.toggle('glass', prefs.glass) })
  /** A plain page (the System page): no scene is drawn at all. */
  let plain = $derived(!view.scenery && !!pageConfigs[page]?.plain)
  let active = $derived(scenes ? (view.scenery ? gallery[galleryIndex] ?? 0 : sceneFor(page)) : 0)
  $effect(() => { if (view.selected !== undefined) dir = 1 }) // picked scenes wipe in from the right

  // Entering scenery mode starts from whatever is on screen
  let wasScenery = false
  $effect(() => {
    if (view.scenery && !wasScenery) galleryIndex = Math.max(0, gallery.indexOf(sceneFor(page)))
    wasScenery = view.scenery
  })
  $effect(() => { if (scenes?.[active]) applyTheme(scenes[active].theme) })

  // Prayer banner (home page only). "Just started" = first 12 minutes of the real period; with the
  // "Current prayer" setting it stays up all period, showing the prayer's start time.
  let justStarted = $derived(!!period && (forceBanner || now - period.start.getTime() < 12 * 60_000))
  let showBanner = $derived(!!period && !!pageConfigs[page]?.verse && (justStarted || !!config?.prayer.showCurrent))
  let bannerText = $derived.by(() => {
    if (!period) return ''
    const en = period.prayer.toUpperCase()
    if (justStarted) return `TIME FOR ${en}`
    return `${en} · ${formatTime(period.start)}`
  })
  // The verse box also shows while the Quran player is on, even with the daily verses turned off
  let reciting = $derived(!!recitation.now && recitation.now.status !== 'idle')
  let verseShown = $derived(!!pageConfigs[page]?.verse && (!!config?.verse.enabled || reciting))

  // ---- navigation: tap the right/left half of the screen, swipe, arrow keys.
  // In scenery mode this browses every scene; otherwise it moves between pages.
  let lastNav = 0
  function go(d: Direction) {
    if (!scenes || view.sleeping || view.settingsOpen || view.quran || view.expanded || view.picking !== null || performance.now() - lastNav < 950) return
    const count = view.scenery ? gallery.length : pageConfigs.length
    if (count < 2) return
    lastNav = performance.now()
    dir = d === 'next' ? 1 : -1
    if (view.scenery) galleryIndex = (galleryIndex + dir + count) % count
    else page = (page + dir + count) % count
  }

  $effect(() => onNavigate(go))

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go('next')
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go('prev')
      if (e.key === 'Escape') {
        if (view.sleeping) view.sleeping = false
        else if (view.picking !== null) { view.picking = null; view.preview = null }
        else if (view.settingsOpen) view.settingsOpen = false
        else if (view.quran) view.quran = false
        else if (view.expanded) view.expanded = null
        else view.scenery = false
      }
    }
    let downX = 0, downY = 0
    const onDown = (e: PointerEvent) => ((downX = e.clientX), (downY = e.clientY))
    const onUp = (e: PointerEvent) => {
      // Taps on the boxes (clock, Salah, settings, ✕) are theirs, not navigation
      if (view.sleeping || view.settingsOpen || view.quran || view.expanded || view.picking !== null || (e.target as Element | null)?.closest?.('button, .panel, figure, canvas.banner')) return
      const dx = e.clientX - downX, dy = e.clientY - downY
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 'next' : 'prev')
      else if (Math.hypot(dx, dy) < 10) go(e.clientX > window.innerWidth / 2 ? 'next' : 'prev')
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  })

  const AREAS: Area[] = [
    'top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right',
    'rooftop-left', 'rooftop-right', 'full',
  ]
  let current = $derived(pageConfigs[page])
  /** A page lists its own widgets, or `true` for the shared ones in dashboard.json → widgets. */
  let pageWidgets = $derived<WidgetConfig[]>(Array.isArray(current?.widgets) ? current.widgets : current?.widgets ? (config?.widgets ?? []) : [])
  const inArea = (area: Area) => pageWidgets.filter((w) => w.area === area && widgets[w.id])
</script>

<main>
  {#if error}
    <pre class="error">{`┌─ dashboard failed to start ─────────────
│ ${error}
│
│ Check the server:  journalctl -u rpi-dashboard -f
└──────────────────────────────────────────`}</pre>
  {:else if config && scenes}
    <AsciiScene {config} {scenes} {active} {dir} paused={plain || view.sleeping} />

    {#if view.sleeping}
      <!-- Sleep mode: the scene is paused and every widget unmounted (their timers stop with them) -->
      <SleepScreen />
    {:else}
    {#if view.scenery}
      <!-- Scenery mode: only the art, and one faint ✕ to go home -->
      <button class="exit-scenery" onclick={() => (view.scenery = false)} aria-label="Exit scenery mode" transition:fade={{ duration: 400 }}>✕</button>
    {:else}
    {#key page}
      {#if current?.widgets || current?.verse}
        <div class="widgets" in:fade={{ duration: 500, delay: 500 }} out:fade={{ duration: 250 }}>
          <!-- Only areas with something in them: an empty area is still a box that takes taps, and
               the full-screen one (System page) sat over the clock on every other page -->
          {#each AREAS.filter((a) => (a === 'top-center' ? !!current?.verse : inArea(a).length > 0)) as area (area)}
            <div class="area {area}">
              {#if area === 'top-center'}
                {#if verseShown}<Verse rotateMinutes={config.verse.rotateMinutes} daily={config.verse.enabled} />{/if}
                {#if showBanner && period}
                  <!-- Under the verse; or, with the verse off, boxed in the verse's place -->
                  {#key period.prayer + bannerText}
                    <PixelTitle text={PRAYER_NAMES[period.prayer].ar} subtitle={bannerText} label="Current prayer: {PRAYER_NAMES[period.prayer].en}" boxed={!verseShown} />
                  {/key}
                {/if}
              {/if}
              {#if pageWidgets.length}
                {#each inArea(area) as w (w.id)}
                  {@const Widget = widgets[w.id].component}
                  <Widget options={w.options} />
                {/each}
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/key}
    {/if}

    {#if !view.scenery && page > 0 && view.picking === null && !plain}
      <!-- Every page but home (and plain pages): a small box to change its background -->
      {#key page}
        <button class="bg-box" onclick={() => pickBackground(page, current?.sceneOverride)} in:fade={{ duration: 500, delay: 500 }} aria-label="Change this page's background">
          ▣ Background <span>▸</span>
        </button>
      {/key}
    {/if}

    {#if view.settingsOpen}<Settings {config} homeBackground={pageConfigs[0]?.sceneOverride ? pretty(pageConfigs[0].sceneOverride) : 'Follow prayer times'} />{/if}
    {#if view.quran}<QuranPlayer />{/if}
    {#if view.picking !== null}
      <BackgroundPicker {config} page={view.picking} names={gallery.map((i) => sceneNames[i]).filter(Boolean)} />
    {/if}
    {/if}
  {/if}
</main>

<style>
  main { position: relative; width: 100%; height: 100%; overflow: hidden; }

  .widgets {
    position: absolute;
    inset: 0;
    display: grid;
    /* The middle column takes only the space between the side boxes, so the verse can't overlap them */
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: auto 1fr auto;
    grid-template-areas:
      'top-left top-center top-right'
      'middle-left . middle-right'
      'bottom-left bottom-center bottom-right';
    column-gap: 2.5vw;
    padding: 3.5vh 2.5vw;
    pointer-events: none;
  }
  .area { display: flex; flex-direction: column; gap: 1.6rem; pointer-events: auto; min-width: 0; }
  .area:empty { display: none; }
  .top-left { grid-area: top-left; align-items: flex-start; }
  .top-center { grid-area: top-center; align-items: center; gap: 1.2rem; }
  .top-right { grid-area: top-right; align-items: flex-end; }
  .middle-left { grid-area: middle-left; align-self: center; align-items: flex-start; }
  .middle-right { grid-area: middle-right; align-self: center; align-items: flex-end; }
  .bottom-left { grid-area: bottom-left; align-items: flex-start; justify-content: flex-end; }
  .bottom-center { grid-area: bottom-center; align-items: center; justify-content: flex-end; }
  .bottom-right { grid-area: bottom-right; align-items: flex-end; justify-content: flex-end; }
  /* The Haram scene (haram.ts) is sized by screen height: the expansion rooftops run from 38.3vh to
     76.7vh either side of the center (portico rx 46 → outer rx 92, of 120 pixel rows). */
  /* Both cards get the same box. No transform here: it would trap the cards' full-screen views. */
  .rooftop-left, .rooftop-right { position: absolute; top: 32vh; width: 31vh; height: 36vh; }
  .full { position: absolute; inset: 3.5vh 2.5vw; }
  .rooftop-left { left: calc(50vw - 57.5vh - 15.5vh); }
  .rooftop-right { left: calc(50vw + 57.5vh - 15.5vh); }

  /* Same see-through box as the clock (Panel), small, at the bottom middle */
  .bg-box {
    all: unset;
    position: absolute; left: 50%; bottom: 3.5vh; transform: translateX(-50%); z-index: 5;
    padding: 0.55rem 1.1rem; cursor: none;
    color: var(--fg); font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase;
    border: 1px solid color-mix(in srgb, var(--muted) 80%, transparent);
    background: color-mix(in srgb, var(--bg) 86%, transparent);
  }
  :global(html.glass) .bg-box { background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(2px); }
  .bg-box span { color: var(--accent); margin-left: 0.4rem; }
  .bg-box:active { border-color: var(--accent); }

  .exit-scenery {
    all: unset;
    position: absolute; left: 50%; bottom: 3vh; transform: translateX(-50%); z-index: 10;
    width: 2.6rem; height: 2.6rem; display: grid; place-items: center;
    font-size: 1.1rem; color: #fff; cursor: none;
    border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 50%;
    background: rgba(0, 0, 0, 0.18);
    opacity: 0.22; /* barely there until touched */
    transition: opacity 0.2s;
  }
  .exit-scenery:active { opacity: 0.8; }

  .error { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); color: var(--accent); }
</style>
