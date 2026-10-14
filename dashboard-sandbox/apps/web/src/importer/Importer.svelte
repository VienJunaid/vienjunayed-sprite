<script lang="ts">
  import { api } from '../lib/api'
  import { imageToAscii } from '../lib/ascii'
  import { imageToPixelArt, type PixelArt } from '../lib/pixelart'
  import type { SceneConfig } from '../lib/types'
  import { decodeFile, type Decoded } from './decode'

  let style = $state<'ascii' | 'pixel'>('pixel')
  let kind = $state<'character' | 'background'>('character')
  let name = $state('')
  let cols = $state(24)
  let ramp = $state(' .:-=+*#%@')
  let maxColors = $state(20)
  let invert = $state(false)
  let transparentBg = $state(true)
  let solid = $state(false)
  let fps = $state(8)
  let decoded = $state<Decoded>()
  let status = $state('')
  let frame = $state(0)
  let assets = $state<{ characters: string[]; backgrounds: string[] }>({ characters: [], backgrounds: [] })
  let canvas = $state<HTMLCanvasElement>()

  $effect(() => {
    api.assetList().then((a) => (assets = a))
  })

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    status = 'decoding…'
    decoded = await decodeFile(file)
    fps = decoded.fps
    name ||= file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').slice(0, 64)
    if (kind === 'background') cols = style === 'pixel' ? 192 : 120
    status = `${decoded.frames.length} frame(s), ${decoded.width}×${decoded.height}`
  }

  const keepAlpha = $derived(kind === 'character' && transparentBg)

  let asciiFrames = $derived.by(() => {
    if (!decoded || style !== 'ascii') return []
    const d = decoded
    return d.frames.map((f) =>
      imageToAscii(f, d.width, d.height, { cols, ramp, invert, alphaThreshold: keepAlpha ? 100 : -1 }),
    )
  })

  let pixelArt = $derived.by((): PixelArt | undefined => {
    if (!decoded || style !== 'pixel') return undefined
    return imageToPixelArt(decoded.frames, decoded.width, decoded.height, { cols, maxColors, transparent: keepAlpha })
  })

  let frameCount = $derived(style === 'pixel' ? (pixelArt?.frames.length ?? 0) : asciiFrames.length)

  $effect(() => {
    if (frameCount < 2) return
    const id = setInterval(() => (frame = (frame + 1) % frameCount), 1000 / Math.max(0.5, fps))
    return () => clearInterval(id)
  })

  // Pixel preview: each pixel drawn as a 10×9 block (the shape it has on the dashboard).
  $effect(() => {
    if (!canvas || !pixelArt) return
    const rows = pixelArt.frames[frame % pixelArt.frames.length]
    const pw = 10, ph = 9
    canvas.width = (rows[0]?.length ?? 0) * pw
    canvas.height = rows.length * ph
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    rows.forEach((row, y) =>
      [...row].forEach((k, x) => {
        const c = pixelArt.palette[k]
        if (!c) return
        ctx.fillStyle = c
        ctx.fillRect(x * pw, y * ph, pw, ph)
      }),
    )
  })

  async function save(andUse: boolean) {
    if (!frameCount || !name) return
    let asset: object
    if (style === 'pixel') {
      asset = kind === 'character'
        ? { name, fps, palette: pixelArt!.palette, frames: pixelArt!.frames }
        : { name, type: 'frames', fps, palette: pixelArt!.palette, frames: pixelArt!.frames }
    } else {
      asset = kind === 'character'
        ? { name, fps, solid, frames: asciiFrames }
        : { name, type: 'frames', fps, ramp, frames: asciiFrames }
    }
    const res = await api.saveAsset(kind, asset)
    if (!res.ok) {
      status = `save failed: ${(await res.json()).error ?? res.status}`
      return
    }
    status = `saved assets/${kind === 'character' ? 'characters' : 'backgrounds'}/${name}.json`
    if (andUse) {
      const config = await api.config()
      // Add to the first page's scene (or the single `scene` when there are no pages)
      const ref = config.pages?.[0]?.scene ?? config.scene
      const sceneName = typeof ref === 'string' ? ref : undefined
      const scene = sceneName ? await api.scene(sceneName) : (ref as SceneConfig)
      if (kind === 'background') scene.background = name
      else scene.characters.push({ asset: name, x: 0.5, y: 0.9, anchor: 'bottom-center' })
      if (sceneName) await api.saveScene(sceneName, scene)
      else await api.saveConfig(config)
      status += ' — the dashboard will reload with it'
    }
    assets = await api.assetList()
  }
</script>

<div class="page">
  <h1>Asset importer</h1>
  <p class="muted">Turn a GIF, PNG, JPG or WebP into a dashboard character or animated background.</p>

  <div class="layout">
    <form onsubmit={(e) => e.preventDefault()}>
      <label>File <input type="file" accept="image/gif,image/png,image/jpeg,image/webp" onchange={onFile} /></label>
      <fieldset>
        <legend>Style</legend>
        <label><input type="radio" bind:group={style} value="pixel" /> Pixel art (color)</label>
        <label><input type="radio" bind:group={style} value="ascii" /> ASCII</label>
      </fieldset>
      <fieldset>
        <legend>Use as</legend>
        <label><input type="radio" bind:group={kind} value="character" /> Character</label>
        <label><input type="radio" bind:group={kind} value="background" /> Background</label>
      </fieldset>
      <label>Name <input bind:value={name} placeholder="my-lantern" /></label>
      <label>
        Width: {cols} {style === 'pixel' ? 'pixels' : 'columns'}
        <input type="range" min="8" max="240" bind:value={cols} />
      </label>
      {#if style === 'pixel'}
        <label>Colors: {maxColors} <input type="range" min="2" max="64" bind:value={maxColors} /></label>
      {:else}
        <label>Ramp (dark → bright) <input bind:value={ramp} /></label>
        <label><input type="checkbox" bind:checked={invert} /> Invert brightness</label>
      {/if}
      <label>FPS <input type="number" min="0.5" max="30" step="0.5" bind:value={fps} /></label>
      {#if kind === 'character'}
        <label><input type="checkbox" bind:checked={transparentBg} /> Transparent pixels → see-through</label>
        {#if style === 'ascii'}
          <label><input type="checkbox" bind:checked={solid} /> Solid (hide what's behind the outline)</label>
        {/if}
      {/if}
      <div class="buttons">
        <button disabled={!frameCount || !name} onclick={() => save(false)}>Save</button>
        <button disabled={!frameCount || !name} onclick={() => save(true)}>
          Save &amp; {kind === 'background' ? 'use as background' : 'add to scene'}
        </button>
      </div>
      <p class="status">{status}</p>
      <p class="muted hint">
        Tip: for characters, a PNG with a transparent background works best. On a 1080p screen the
        dashboard is 60 rows tall, which is 120 pixels, so a figure 30–40 pixels tall reads well.
      </p>

      <h2>Existing</h2>
      <p class="muted">Characters: {assets.characters.join(', ') || '—'}</p>
      <p class="muted">Backgrounds: {assets.backgrounds.join(', ') || '—'}</p>
    </form>

    <div class="preview">
      {#if style === 'pixel'}
        {#if pixelArt}<canvas bind:this={canvas}></canvas>{:else}<span class="muted">preview</span>{/if}
      {:else}
        <pre>{asciiFrames[frame % Math.max(1, asciiFrames.length)]?.join('\n') ?? 'preview'}</pre>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(html.importer), :global(html.importer body), :global(html.importer #app) {
    cursor: auto; user-select: auto; overflow: auto; height: auto; min-height: 100vh;
  }
  .page { padding: 2rem; font-size: 14px; }
  h1 { color: var(--accent); font-size: 1.4rem; }
  h2 { color: var(--accent); font-size: 1rem; margin-top: 1.5rem; }
  .muted { color: var(--muted); }
  .hint { font-size: 12px; }
  .layout { display: flex; gap: 2rem; margin-top: 1.5rem; flex-wrap: wrap; }
  form { display: flex; flex-direction: column; gap: 0.8rem; width: 22rem; }
  fieldset { border: none; display: flex; gap: 1rem; flex-wrap: wrap; }
  legend { color: var(--muted); width: 100%; margin-bottom: 0.2rem; }
  label { display: flex; flex-direction: column; gap: 0.3rem; }
  label:has(input[type='checkbox']), fieldset label { flex-direction: row; align-items: center; }
  input, button { font: inherit; color: var(--fg); background: var(--bg); border: 1px solid var(--muted); padding: 0.3rem 0.5rem; }
  button { cursor: pointer; color: var(--accent); }
  button:disabled { opacity: 0.4; cursor: default; }
  .buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .status { color: var(--fg); min-height: 1.2em; }
  .preview {
    flex: 1; min-width: 20rem; border: 1px solid var(--muted); padding: 1rem; overflow: auto; max-height: 80vh;
    background: repeating-conic-gradient(color-mix(in srgb, var(--muted) 25%, transparent) 0 25%, transparent 0 50%) 0 0 / 16px 16px;
  }
  pre { font-family: inherit; font-size: 10px; line-height: 1.1; color: var(--fg); }
  canvas { image-rendering: pixelated; max-width: 100%; }
</style>
