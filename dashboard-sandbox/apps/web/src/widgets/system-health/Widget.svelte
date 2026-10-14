<script lang="ts">
  import { renderStats } from '../../lib/renderStats'
  import Panel from '../Panel.svelte'
  import Chart from './Chart.svelte'
  import { ago, bar, bytes, duration, LEVEL_COLORS, rate, tempLevel, usageLevel, wifi, type Level } from './format'

  /**
   * The System page: Raspberry Pi health, btop-style. CPU, temperature and throttling, memory and
   * storage, network, the system itself, and how the dashboard is running. Polls GET /api/system.
   */
  interface Status {
    info: { host: string; model: string; os: string; kernel: string; node: string; cores: number; commit?: { hash: string; subject: string; time: number } }
    now: {
      time: number
      uptime: number
      cpu: { total: number; cores: number[]; load: number[]; mhz: number | null; maxMhz: number | null }
      temp: number | null
      throttle: { now: string[]; past: string[] } | null
      fanRpm: number | null
      mem: { total: number; used: number; swapTotal: number; swapUsed: number }
      disk: { total: number; used: number } | null
      net: { ips: { name: string; address: string }[]; rx: number | null; tx: number | null; wifiDbm: number | null }
      service: { uptime: number; rss: number }
      processes: { name: string; cpu: number; mem: number }[]
    }
    history: { step: number; cpu: number[]; mem: number[]; temp: (number | null)[]; rx: (number | null)[]; tx: (number | null)[] }
    calendar: { configured: boolean; updated?: string; error?: string }
  }

  let s = $state<Status>()
  let error = $state('')
  let render = $state({ ...renderStats })

  async function load() {
    try {
      const res = await fetch('/api/system')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      s = await res.json()
      error = ''
    } catch (e) {
      error = (e as Error).message
    }
    render = { ...renderStats }
  }

  $effect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  })

  const color = (l: Level) => LEVEL_COLORS[l]
  // Chromium's software fallbacks: drawing on the CPU, which runs the Pi hot
  let softwareGpu = $derived(/swiftshader|llvmpipe|software|softpipe/i.test(render.gpu))

  // "Raspberry Pi 5 Model B Rev 1.0" → "Raspberry Pi 5"
  let title = $derived(s ? s.info.model.replace(/\s+Model\b.*$/, '') : '')
  /** "52–61 °C" over the chart's history */
  const range = (vs: (number | null)[]) => {
    const r = vs.filter((v): v is number => v !== null)
    return r.length ? `${Math.floor(Math.min(...r))}–${Math.ceil(Math.max(...r))} °C` : ''
  }
  let mins = $derived(s ? Math.round((s.history.cpu.length * s.history.step) / 60_000) : 0)

  /** One word for the whole Pi, from the worst reading. */
  let overall = $derived.by((): { level: Level; text: string } => {
    if (!s) return { level: 'ok', text: '' }
    const { temp, throttle, mem, disk, cpu } = s.now
    if (throttle?.now.length || (temp !== null && temp >= 80)) return { level: 'bad', text: 'Needs attention' }
    const worst = Math.max(cpu.total / 100, mem.used / mem.total, disk ? disk.used / disk.total : 0)
    if ((temp !== null && temp >= 70) || worst >= 0.9) return { level: 'hot', text: 'Working hard' }
    if (throttle?.past.length || worst >= 0.8) return { level: 'warn', text: 'Mostly fine' }
    return { level: 'ok', text: 'All good' }
  })
</script>

<div class="health">
  {#if !s}
    <p class="dim">{error ? `System info unavailable (${error})` : 'reading the Pi…'}</p>
  {:else}
    <div class="top">
      <h1>{title} <span>{s.info.host} · up {duration(s.now.uptime)}</span></h1>
      <div class="overall" style:color={color(overall.level)}>● {overall.text}</div>
    </div>

    <div class="grid">
      <Panel title="CPU" icon="▣">
        <div class="big" style:color={color(usageLevel(s.now.cpu.total / 100))}>{s.now.cpu.total.toFixed(0)}<small>%</small></div>
        <div class="chart"><Chart values={s.history.cpu} min={0} max={100} color={(v) => color(usageLevel(v / 100))} /></div>
        <div class="axis"><span>{mins} min ago</span><span>0–100%</span><span>now</span></div>
        <div class="cores" class:many={s.now.cpu.cores.length > 4}>
          {#each s.now.cpu.cores as c, i (i)}
            <div class="core"><span class="k">c{i}</span><span style:color={color(usageLevel(c / 100))}>{bar(c / 100, 10)}</span><span class="v">{c.toFixed(0)}%</span></div>
          {/each}
        </div>
        <dl>
          <dt>Load</dt><dd>{s.now.cpu.load.map((l) => l.toFixed(2)).join('  ')}</dd>
          {#if s.now.cpu.mhz}<dt>Clock</dt><dd>{(s.now.cpu.mhz / 1000).toFixed(2)} GHz{#if s.now.cpu.maxMhz}&nbsp;<span class="dim">/ {(s.now.cpu.maxMhz / 1000).toFixed(1)}</span>{/if}</dd>{/if}
        </dl>
      </Panel>

      <Panel title="Temperature" icon="♨">
        {#if s.now.temp !== null}
          <div class="big" style:color={color(tempLevel(s.now.temp))}>{s.now.temp.toFixed(1)}<small>°C</small></div>
          <div class="chart"><Chart values={s.history.temp} color={(v) => color(tempLevel(v))} /></div>
          <div class="axis"><span>{mins} min ago</span><span>{range(s.history.temp)}</span><span>now</span></div>
        {:else}
          <div class="big dim">—</div>
          <p class="dim">No temperature sensor here (only on the Pi).</p>
        {/if}
        <dl>
          {#if s.now.fanRpm !== null}<dt>Fan</dt><dd>{s.now.fanRpm} rpm</dd>{/if}
          <dt>Throttling</dt>
          <dd>
            {#if !s.now.throttle}<span class="dim">n/a (not a Pi)</span>
            {:else if !s.now.throttle.now.length && !s.now.throttle.past.length}<span style:color={color('ok')}>✓ none since boot</span>
            {:else}
              {#each s.now.throttle.now as f (f)}<div style:color={color('bad')}>✕ {f} now</div>{/each}
              {#each s.now.throttle.past as f (f)}<div style:color={color('warn')}>▲ {f} since boot</div>{/each}
            {/if}
          </dd>
        </dl>
        {#if s.now.throttle?.past.includes('Under-voltage')}
          <p class="hint">Under-voltage usually means the power supply or cable can't keep up. The Pi 5 wants the official 27 W (5 V 5 A) supply.</p>
        {/if}
      </Panel>

      <Panel title="Memory & storage" icon="◫">
        {@const mem = s.now.mem.used / s.now.mem.total}
        <div class="meter">
          <div class="row"><span>RAM</span><span class="v">{bytes(s.now.mem.used)} / {bytes(s.now.mem.total)}</span></div>
          <pre style:color={color(usageLevel(mem))}>{bar(mem, 30)} {(mem * 100).toFixed(0)}%</pre>
        </div>
        {#if s.now.mem.swapTotal}
          {@const swap = s.now.mem.swapUsed / s.now.mem.swapTotal}
          <div class="meter">
            <div class="row"><span>Swap</span><span class="v">{bytes(s.now.mem.swapUsed)} / {bytes(s.now.mem.swapTotal)}</span></div>
            <pre style:color={color(usageLevel(swap))}>{bar(swap, 30)} {(swap * 100).toFixed(0)}%</pre>
          </div>
        {/if}
        <div class="chart"><Chart values={s.history.mem} min={0} max={100} color={(v) => color(usageLevel(v / 100))} /></div>
        <div class="axis"><span>RAM, {mins} min ago</span><span>now</span></div>
        {#if s.now.disk}
          {@const disk = s.now.disk.used / s.now.disk.total}
          <div class="meter">
            <div class="row"><span>Disk /</span><span class="v">{bytes(s.now.disk.used)} / {bytes(s.now.disk.total)}</span></div>
            <pre style:color={color(usageLevel(disk))}>{bar(disk, 30)} {(disk * 100).toFixed(0)}%</pre>
          </div>
        {/if}
      </Panel>

      <Panel title="Network" icon="⇅">
        <dl>
          {#each s.now.net.ips as ip (ip.name + ip.address)}<dt>{ip.name}</dt><dd>{ip.address}</dd>{:else}<dt>IP</dt><dd style:color={color('bad')}>offline</dd>{/each}
          {#if s.now.net.wifiDbm !== null}
            {@const w = wifi(s.now.net.wifiDbm)}
            <dt>Wi-Fi</dt><dd>{w.bars} {w.word} <span class="dim">({s.now.net.wifiDbm} dBm)</span></dd>
          {/if}
        </dl>
        {#if s.now.net.rx !== null}
          <div class="row io"><span>↓ In</span><span class="v">{rate(s.now.net.rx)}</span></div>
          <div class="chart"><Chart values={s.history.rx} min={0} color="#7aa2f7" /></div>
          <div class="row io"><span>↑ Out</span><span class="v">{rate(s.now.net.tx)}</span></div>
          <div class="chart"><Chart values={s.history.tx} min={0} color="#bb9af7" /></div>
        {:else}
          <p class="dim">Traffic rates are read on the Pi (Linux) only.</p>
        {/if}
      </Panel>

      <Panel title="System" icon="⌂">
        <dl>
          <dt>Model</dt><dd>{s.info.model}</dd>
          <dt>OS</dt><dd>{s.info.os}</dd>
          <dt>Kernel</dt><dd>{s.info.kernel}</dd>
          <dt>Host</dt><dd>{s.info.host}</dd>
          <dt>Uptime</dt><dd>{duration(s.now.uptime)}</dd>
          <dt>Cores</dt><dd>{s.info.cores}</dd>
          <dt>Node</dt><dd>{s.info.node}</dd>
        </dl>
        {#if s.now.processes.length}
          <div class="procs">
            <div class="ph"><span>Top processes</span><span>CPU</span><span>RAM</span></div>
            {#each s.now.processes as p, i (i)}
              <div class="pr">
                <span class="pn">{p.name.split('/').pop()}</span>
                <span style:color={color(usageLevel(p.cpu / 100))}>{p.cpu.toFixed(1)}%</span>
                <span class="dim">{p.mem.toFixed(1)}%</span>
              </div>
            {/each}
          </div>
        {/if}
      </Panel>

      <Panel title="Dashboard" icon="☾">
        <dl>
          {#if s.info.commit}
            <dt>Version</dt><dd><span class="accent">{s.info.commit.hash}</span> <span class="dim">· {ago(s.info.commit.time, s.now.time)}</span></dd>
            <dt></dt><dd class="dim ellipsis">{s.info.commit.subject}</dd>
          {/if}
          <dt>Service</dt><dd>up {duration(s.now.service.uptime)} <span class="dim">· {bytes(s.now.service.rss)}</span></dd>
          <dt>Renderer</dt><dd>{render.renderer || '—'} <span class="dim">· {render.cols}×{render.rows} cells</span></dd>
          {#if render.gpu}
            <dt>GPU</dt>
            <dd>
              {#if softwareGpu}<span style:color={color('bad')}>✕ {render.gpu}: software, no GPU</span>
              {:else}<span style:color={color('ok')}>✓</span> {render.gpu}{/if}
            </dd>
          {/if}
          <dt>Frames</dt>
          <dd>
            {#if render.paused}
              <span class="dim">paused on this page</span>
            {:else}
              <span style:color={color(render.fps >= 25 ? 'ok' : render.fps >= 15 ? 'warn' : 'bad')}>{render.fps} fps</span>
              <span class="dim">· {render.msPerFrame.toFixed(1)} ms/frame</span>
            {/if}
          </dd>
          <dt>Screen</dt><dd>{window.innerWidth}×{window.innerHeight} <span class="dim">@{window.devicePixelRatio}x</span></dd>
          <dt>Calendar</dt>
          <dd>
            {#if !s.calendar.configured}<span class="dim">not set up</span>
            {:else if s.calendar.error}<span style:color={color('hot')}>{s.calendar.error}</span>
            {:else if s.calendar.updated}synced {ago(Date.parse(s.calendar.updated), s.now.time)}
            {:else}<span class="dim">not synced yet</span>{/if}
          </dd>
        </dl>
      </Panel>
    </div>
  {/if}
</div>

<style>
  .health { width: 100%; height: 100%; display: flex; flex-direction: column; gap: 1.4rem; }
  .top { display: flex; align-items: baseline; justify-content: space-between; }
  h1 { font-size: 1.3rem; font-weight: 700; color: var(--accent); letter-spacing: 0.06em; text-transform: uppercase; }
  h1 span { margin-left: 1rem; font-size: 0.85rem; font-weight: 400; color: var(--muted); letter-spacing: 0.04em; text-transform: none; }
  .overall { font-size: 0.9rem; letter-spacing: 0.1em; text-transform: uppercase; }

  /* Stays plain even with the Glass blur setting on */
  :global(html.glass) .grid :global(.panel) { backdrop-filter: none; background: var(--bg); }
  .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 1.6rem 1.4rem; }
  /* No overflow: hidden on the panels: it would clip the title cut into the top border.
     Solid and unblurred: this page is plain on purpose, and backdrop blur is costly on the Pi. */
  .grid :global(.panel) { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 0.5rem; backdrop-filter: none; background: var(--bg); }
  .chart { flex: 1; min-height: 2.5rem; }

  .big { font-size: 2.6rem; line-height: 1; font-weight: 700; }
  .big small { font-size: 1rem; margin-left: 0.25rem; font-weight: 400; color: var(--muted); }
  pre { font-family: inherit; margin: 0; white-space: pre; overflow: hidden; }
  .axis { display: flex; justify-content: space-between; color: var(--muted); font-size: 0.68rem; }

  .cores { display: grid; grid-template-columns: 1fr; gap: 0.1rem 1rem; font-size: 0.78rem; }
  .cores.many { grid-template-columns: 1fr 1fr; }
  .core { display: flex; gap: 0.5rem; white-space: nowrap; }
  .core .v { margin-left: auto; color: var(--muted); }
  .k { color: var(--muted); min-width: 1.6rem; }

  dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.25rem 1rem; font-size: 0.85rem; }
  dt { color: var(--muted); }
  dd { color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  dd div { white-space: nowrap; }

  .meter { display: flex; flex-direction: column; gap: 0.2rem; }
  .meter pre { font-size: 0.85rem; }
  .row { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--fg); }
  .row .v { color: var(--muted); }

  .procs { margin-top: 0.6rem; font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.2rem; }
  .ph, .pr { display: grid; grid-template-columns: minmax(0, 1fr) 4.5rem 4rem; gap: 0.6rem; text-align: right; }
  .ph { color: var(--muted); font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; border-bottom: 1px dashed color-mix(in srgb, var(--muted) 50%, transparent); padding-bottom: 0.2rem; }
  .ph span:first-child, .pn { text-align: left; }
  .pn { color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .accent { color: var(--accent); }
  .dim { color: var(--muted); }
  .ellipsis { overflow: hidden; text-overflow: ellipsis; }
  .hint { color: var(--muted); font-size: 0.75rem; line-height: 1.4; }
  p { font-size: 0.85rem; }
</style>
