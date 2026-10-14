<script lang="ts">
  import type { DashboardConfig } from '../lib/types'
  import { createRenderer, Grid } from '../renderer'
  import { GlyphSet, Palette } from '../renderer/glyphs'
  import { startLoop } from '../renderer/loop'
  import { renderStats } from '../lib/renderStats'
  import { hash } from '../scene/pixels'
  import { createScene, type LoadedPage } from '../scene/scene'

  // `scenes` are every scene any page can show; `active` is the one on screen, `dir` the wipe direction.
  let { config, scenes: pages, active, dir, paused = false }: {
    config: DashboardConfig
    scenes: LoadedPage[]
    active: number
    dir: 1 | -1
    /** Draw nothing (a plain page is showing): the canvas is hidden and the loop idles. */
    paused?: boolean
  } = $props()

  let canvas: HTMLCanvasElement
  const debug = new URLSearchParams(location.search).has('debug')
  let stats = $state('')

  // The render loop reads `active` through this box so switching scenes doesn't rebuild everything.
  const nav = { page: -1, from: 0, start: -1, dir: 1, paused: false }
  $effect(() => {
    // Into or out of a plain page: cut straight to the new scene (no wipe from a stale grid)
    if (paused || nav.paused) {
      nav.paused = paused
      nav.page = active
      nav.start = -1
      renderStats.paused = paused
      return
    }
    if (nav.page === -1) { nav.page = active; return }
    if (active === nav.page) return
    nav.from = nav.page
    nav.dir = dir
    nav.page = active
    nav.start = performance.now()
  })

  const TRANSITION_MS = 900

  $effect(() => {
    const renderer = createRenderer(canvas)
    // Known right away, even if the first page shown is a paused (plain) one
    Object.assign(renderStats, { renderer: renderer.kind, gpu: renderer.gpu ?? '' })
    const shared = { glyphs: new GlyphSet(), palette: new Palette(pages[0].theme.background) }
    const scenes = pages.map((p) => createScene(p.scene, p.theme, p.assets, shared))
    const edgeGlyphs = ['█', '▓', '▒', '░'].map((c) => shared.glyphs.id(c))
    const edgeColors = pages.map((p) => shared.palette.id(p.theme.accent))
    let grids: Grid[] = []
    let out = new Grid(1, 1)

    const layout = () => {
      const dpr = window.devicePixelRatio || 1
      const { rows: targetRows, cellWidth, cellHeight } = config.grid
      // With `rows`, every screen gets the same composition (a 7" panel is a scaled-down 1080p).
      // Otherwise cell sizes are for 1080p and shrink on smaller screens.
      const scale = Math.min(1, Math.max(0.6, window.innerHeight / 1080))
      const ch = targetRows
        ? Math.max(4, Math.floor((window.innerHeight * dpr) / targetRows))
        : Math.max(6, Math.round(cellHeight * scale * dpr))
      const cw = Math.max(2, Math.round((ch * cellWidth) / cellHeight))
      const cols = Math.ceil((window.innerWidth * dpr) / cw)
      const rows = Math.ceil((window.innerHeight * dpr) / ch)
      grids = pages.map(() => new Grid(cols, rows))
      out = new Grid(cols, rows)
      renderer.resize(cols, rows, cw, ch)
      canvas.style.width = `${(cols * cw) / dpr}px`
      canvas.style.height = `${(rows * ch) / dpr}px`
    }
    layout()
    window.addEventListener('resize', layout)

    /**
     * Pixel wipe: the incoming page sweeps across with a jagged edge of glowing block
     * characters (█▓▒░ in the new page's accent color).
     */
    function composite(a: Grid, b: Grid, p: number, dir: number, accent: number) {
      const jag = 10
      const front = p * (out.cols + jag * 2) - jag
      for (let y = 0; y < out.rows; y++)
        for (let x = 0; x < out.cols; x++) {
          const i = y * out.cols + x
          const pos = (dir > 0 ? out.cols - 1 - x : x) + hash(x >> 1, y) * jag
          const d = front - pos
          const src = d > 0 ? b : a
          out.glyphs[i] = src.glyphs[i]
          out.colors[i] = src.colors[i]
          out.bgs[i] = src.bgs[i]
          if (d > -1 && d < 3) {
            out.glyphs[i] = edgeGlyphs[Math.max(0, Math.min(3, Math.floor(d + 1)))]
            out.colors[i] = accent
          }
        }
    }

    let frames = 0, cpu = 0, lastStat = performance.now()
    const stop = startLoop(config.fps || 30, (t) => {
      if (nav.paused) {
        // Idle; restart the FPS count so the first reading after the pause isn't skewed
        frames = 0
        cpu = 0
        lastStat = performance.now()
        return
      }
      const start = performance.now()
      const cur = nav.page
      let target = grids[cur]
      if (nav.start >= 0) {
        const p = (start - nav.start) / TRANSITION_MS
        if (p >= 1) nav.start = -1
        else {
          const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
          scenes[nav.from].draw(grids[nav.from], t)
          scenes[cur].draw(grids[cur], t)
          composite(grids[nav.from], grids[cur], eased, nav.dir, edgeColors[cur])
          target = out
        }
      }
      if (target !== out) scenes[cur].draw(target, t)
      renderer.draw(target, shared.glyphs, shared.palette)
      cpu += performance.now() - start
      if (++frames % 30 === 0) {
        const now = performance.now()
        Object.assign(renderStats, {
          renderer: renderer.kind, gpu: renderer.gpu ?? '', cols: target.cols, rows: target.rows,
          fps: Math.round((30 * 1000) / (now - lastStat)), msPerFrame: cpu / 30,
        })
        if (debug) stats = `${renderer.kind} · ${target.cols}×${target.rows} · ${renderStats.fps} fps · ${renderStats.msPerFrame.toFixed(1)} ms/frame`
        lastStat = now
        cpu = 0
      }
    })

    return () => {
      stop()
      window.removeEventListener('resize', layout)
      renderer.destroy()
    }
  })
</script>

<canvas bind:this={canvas} class:paused></canvas>
{#if debug}<div class="stats">{stats}</div>{/if}

<style>
  canvas { position: absolute; top: 0; left: 0; display: block; image-rendering: pixelated; }
  canvas.paused { visibility: hidden; }
  .stats {
    position: absolute; left: 0.5rem; bottom: 0.5rem; z-index: 10;
    font-size: 0.75rem; color: var(--accent); background: var(--bg); padding: 0.1rem 0.4rem;
  }
</style>
