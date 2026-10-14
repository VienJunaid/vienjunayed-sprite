<script lang="ts">
  import { imageToAscii } from '../../lib/ascii'
  import Panel from '../Panel.svelte'

  interface NowPlaying {
    configured: boolean
    connected: boolean
    active?: boolean
    isPlaying?: boolean
    title?: string
    artist?: string
    art?: string
    progressMs?: number
    durationMs?: number
  }

  let np = $state<NowPlaying>()
  let fetchedAt = $state(0)
  let now = $state(Date.now())
  let art = $state<string[]>([])
  let artUrl = ''

  async function load() {
    try {
      const res = await fetch('/api/spotify/now-playing')
      np = await res.json()
      fetchedAt = Date.now()
      if (np?.art && np.art !== artUrl) loadArt(np.art)
    } catch {
      /* keep last state */
    }
  }

  function loadArt(url: string) {
    artUrl = url
    const img = new Image()
    img.onload = () => (art = imageToAscii(img, img.width, img.height, { cols: 14, rows: 7, ramp: ' .:-=+*#%@' }))
    img.src = `/api/spotify/art?url=${encodeURIComponent(url)}`
  }

  async function control(action: 'play' | 'pause' | 'next' | 'previous') {
    await fetch(`/api/spotify/${action}`, { method: 'POST' })
    setTimeout(load, 400)
  }

  $effect(() => {
    load()
    const poll = setInterval(load, 5000)
    const tick = setInterval(() => (now = Date.now()), 500)
    return () => { clearInterval(poll); clearInterval(tick) }
  })

  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

  let progress = $derived.by(() => {
    if (!np?.durationMs) return 0
    const p = (np.progressMs ?? 0) + (np.isPlaying ? now - fetchedAt : 0)
    return Math.min(p, np.durationMs)
  })

  const BAR = 22
  let bar = $derived.by(() => {
    const filled = np?.durationMs ? Math.round((progress / np.durationMs) * BAR) : 0
    return '━'.repeat(filled) + '●' + '─'.repeat(Math.max(0, BAR - filled))
  })
</script>

<Panel title="Spotify" icon="♫">
  {#if !np}
    <p class="dim">loading…</p>
  {:else if !np.configured}
    <p class="dim">Add SPOTIFY_CLIENT_ID and<br />SPOTIFY_CLIENT_SECRET to .env</p>
  {:else if !np.connected}
    <p class="dim">Connect: open<br /><span class="hl">127.0.0.1:8080/api/spotify/login</span><br />on the Pi</p>
  {:else if !np.active}
    <p class="dim">Nothing playing</p>
  {:else}
    <div class="row">
      {#if art.length}<pre class="art">{art.join('\n')}</pre>{/if}
      <div class="meta">
        <div class="title">{np.title}</div>
        <div class="artist">{np.artist}</div>
        <div class="controls">
          <button onclick={() => control('previous')} aria-label="Previous">⏮</button>
          <button onclick={() => control(np?.isPlaying ? 'pause' : 'play')} aria-label="Play/pause">
            {np.isPlaying ? '⏸' : '▶'}
          </button>
          <button onclick={() => control('next')} aria-label="Next">⏭</button>
        </div>
      </div>
    </div>
    <div class="progress">
      <span>{fmt(progress)}</span><span class="bar">{bar}</span><span>{fmt(np.durationMs ?? 0)}</span>
    </div>
  {/if}
</Panel>

<style>
  .row { display: flex; gap: 1rem; align-items: center; }
  .art { font-family: inherit; font-size: 0.6rem; line-height: 1; color: var(--accent); }
  .meta { min-width: 0; max-width: 16rem; }
  .title { color: var(--fg); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .artist { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .controls { margin-top: 0.4rem; display: flex; gap: 0.3rem; }
  button {
    font: inherit; color: var(--fg); background: none; cursor: none;
    border: 1px solid color-mix(in srgb, var(--muted) 60%, transparent); padding: 0.1rem 0.6rem;
  }
  .progress { margin-top: 0.7rem; display: flex; gap: 0.6rem; font-size: 0.8rem; color: var(--muted); }
  .bar { color: var(--accent); letter-spacing: -0.05em; }
  .dim { color: var(--muted); }
  .hl { color: var(--accent); }
</style>
