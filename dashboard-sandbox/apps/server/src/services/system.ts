import { execFile } from 'node:child_process'
import { readdir, readFile, statfs } from 'node:fs/promises'
import os from 'node:os'
import { promisify } from 'node:util'
import { ROOT } from '../paths.js'

// Raspberry Pi health for the System page. Sampled in the background every few seconds so the
// charts already have history when the page opens. On the Pi it reads /proc, /sys and vcgencmd;
// elsewhere (the Mac in dev) it falls back to what Node's `os` module knows, and Pi-only
// readings are null.

const run = promisify(execFile)
const STEP_MS = 3000
const HISTORY = 600 // 30 minutes
const THROTTLE_MS = 15_000
const PROCESSES_MS = 9_000

const read = (p: string) => readFile(p, 'utf8').catch(() => undefined)
const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? null : Number(s))

// ---- static info (read once) ----

export interface SystemInfo {
  host: string
  model: string
  os: string
  kernel: string
  node: string
  cores: number
  commit?: { hash: string; subject: string; time: number }
}

let info: SystemInfo | undefined

async function loadInfo(): Promise<SystemInfo> {
  const model = (await read('/proc/device-tree/model'))?.replace(/\0/g, '').trim()
  const release = await read('/etc/os-release')
  const pretty = release?.match(/^PRETTY_NAME="?([^"\n]*)"?/m)?.[1]
  const commit = await run('git', ['log', '-1', '--format=%h%x09%ct%x09%s'], { cwd: ROOT })
    .then(({ stdout }) => {
      const [hash, time, subject] = stdout.trim().split('\t')
      return { hash, subject, time: Number(time) * 1000 }
    })
    .catch(() => undefined)
  return {
    host: os.hostname(),
    model: model || `${os.type()} ${os.arch()}`,
    os: pretty || `${os.type()} ${os.release()}`,
    kernel: os.release(),
    node: process.version,
    cores: os.cpus().length,
    commit,
  }
}

// ---- samples ----

interface Throttle {
  /** Active now: under-voltage, frequency capped, throttled, soft temperature limit. */
  now: string[]
  /** Has happened since boot. */
  past: string[]
}

const FLAGS = ['Under-voltage', 'Frequency capped', 'Throttled', 'Soft temperature limit']

export interface Snapshot {
  time: number
  uptime: number
  cpu: { total: number; cores: number[]; load: number[]; mhz: number | null; maxMhz: number | null }
  /** °C, null when there's no sensor (e.g. the Mac). */
  temp: number | null
  throttle: Throttle | null
  fanRpm: number | null
  mem: { total: number; used: number; swapTotal: number; swapUsed: number }
  disk: { total: number; used: number } | null
  net: { ips: { name: string; address: string }[]; rx: number | null; tx: number | null; wifiDbm: number | null }
  service: { uptime: number; rss: number }
  /** Busiest processes by CPU. */
  processes: Process[]
}

interface Process { name: string; cpu: number; mem: number }

let prevCpu = os.cpus().map((c) => c.times)
let prevNet: { rx: number; tx: number; at: number } | undefined
let throttle: Throttle | null = null
let fanPath: string | null | undefined
let processes: Process[] = []
let latest: Snapshot | undefined
const history = { cpu: [] as number[], mem: [] as number[], temp: [] as (number | null)[], rx: [] as (number | null)[], tx: [] as (number | null)[] }

function cpuUsage() {
  const now = os.cpus().map((c) => c.times)
  const cores = now.map((t, i) => {
    const p = prevCpu[i] ?? t
    const busy = t.user + t.nice + t.sys + t.irq - (p.user + p.nice + p.sys + p.irq)
    const total = busy + t.idle - p.idle
    return total > 0 ? Math.round((busy / total) * 1000) / 10 : 0
  })
  prevCpu = now
  return { cores, total: Math.round((cores.reduce((a, b) => a + b, 0) / (cores.length || 1)) * 10) / 10 }
}

async function memory() {
  const meminfo = await read('/proc/meminfo')
  if (!meminfo) return { total: os.totalmem(), used: os.totalmem() - os.freemem(), swapTotal: 0, swapUsed: 0 }
  // MemAvailable, not MemFree: Linux keeps free RAM busy as cache, which is given back on demand
  const kb = (key: string) => Number(meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1] ?? 0) * 1024
  return {
    total: kb('MemTotal'),
    used: kb('MemTotal') - kb('MemAvailable'),
    swapTotal: kb('SwapTotal'),
    swapUsed: kb('SwapTotal') - kb('SwapFree'),
  }
}

async function network() {
  const ips = Object.entries(os.networkInterfaces()).flatMap(([name, addrs]) =>
    (addrs ?? []).filter((a) => a.family === 'IPv4' && !a.internal).map((a) => ({ name, address: a.address })),
  )
  let rx: number | null = null, tx: number | null = null
  const dev = await read('/proc/net/dev')
  if (dev) {
    let r = 0, t = 0
    for (const line of dev.split('\n').slice(2)) {
      const [name, rest] = line.split(':')
      if (!rest || name.trim() === 'lo') continue
      const f = rest.trim().split(/\s+/).map(Number)
      r += f[0]
      t += f[8]
    }
    const at = Date.now()
    if (prevNet) {
      const s = (at - prevNet.at) / 1000
      rx = Math.max(0, (r - prevNet.rx) / s)
      tx = Math.max(0, (t - prevNet.tx) / s)
    }
    prevNet = { rx: r, tx: t, at }
  }
  // /proc/net/wireless: "wlan0: 0000   58.  -52.  -256 ..." → signal level in dBm
  const wl = (await read('/proc/net/wireless'))?.split('\n')[2]?.trim().split(/\s+/)
  const wifiDbm = wl && wl.length > 3 ? Number.parseFloat(wl[3]) : null
  return { ips, rx, tx, wifiDbm: Number.isFinite(wifiDbm) ? wifiDbm : null }
}

async function readThrottle(): Promise<Throttle | null> {
  try {
    const { stdout } = await run('vcgencmd', ['get_throttled'], { timeout: 3000 })
    const bits = Number.parseInt(stdout.split('=')[1], 16)
    return { now: FLAGS.filter((_, i) => bits & (1 << i)), past: FLAGS.filter((_, i) => bits & (1 << (16 + i))) }
  } catch {
    return null // not a Pi, or vcgencmd isn't installed
  }
}

async function topProcesses(): Promise<Process[]> {
  // Linux (the Pi) sorts with --sort; macOS ps sorts by CPU with -r and has no --no-headers
  const args = process.platform === 'linux'
    ? ['-eo', 'comm,pcpu,pmem', '--sort=-pcpu', '--no-headers']
    : ['-Aco', 'comm,pcpu,pmem', '-r']
  try {
    const { stdout } = await run('ps', args, { timeout: 3000 })
    const lines = stdout.trim().split('\n')
    return (process.platform === 'linux' ? lines : lines.slice(1)).slice(0, 5).map((l) => {
      const m = l.trim().match(/^(.*?)\s+([\d.]+)\s+([\d.]+)$/)
      return { name: m?.[1] ?? l.trim(), cpu: Number(m?.[2] ?? 0), mem: Number(m?.[3] ?? 0) }
    })
  } catch {
    return []
  }
}

/** Pi 5 fan speed, if the official fan is attached. */
async function fan() {
  if (fanPath === undefined) {
    const base = '/sys/devices/platform/cooling_fan/hwmon'
    const dir = (await readdir(base).catch(() => []))[0]
    fanPath = dir ? `${base}/${dir}/fan1_input` : null
  }
  return fanPath ? num(await read(fanPath)) : null
}

async function sample() {
  const [mem, net, fanRpm, tempRaw, freq, maxFreq, fs] = await Promise.all([
    memory(),
    network(),
    fan(),
    read('/sys/class/thermal/thermal_zone0/temp'),
    read('/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq'),
    read('/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq'),
    statfs('/').catch(() => undefined),
  ])
  const cpu = cpuUsage()
  const t = num(tempRaw)
  const temp = t === null ? null : Math.round(t / 100) / 10
  const khz = num(freq), maxKhz = num(maxFreq)
  latest = {
    time: Date.now(),
    uptime: os.uptime(),
    cpu: {
      ...cpu,
      load: os.loadavg().map((l) => Math.round(l * 100) / 100),
      mhz: khz ? Math.round(khz / 1000) : os.cpus()[0]?.speed || null,
      maxMhz: maxKhz ? Math.round(maxKhz / 1000) : null,
    },
    temp,
    throttle,
    fanRpm,
    mem,
    disk: fs ? { total: fs.blocks * fs.bsize, used: (fs.blocks - fs.bfree) * fs.bsize } : null,
    net,
    service: { uptime: process.uptime(), rss: process.memoryUsage().rss },
    processes,
  }
  const push = <T>(arr: T[], v: T) => { arr.push(v); if (arr.length > HISTORY) arr.shift() }
  push(history.cpu, cpu.total)
  push(history.mem, Math.round((mem.used / mem.total) * 1000) / 10)
  push(history.temp, temp)
  push(history.rx, net.rx)
  push(history.tx, net.tx)
}

let started = false

/** Start sampling (once). Called when the server starts. */
export function startSystemMonitor() {
  if (started) return
  started = true
  loadInfo().then((i) => (info = i))
  const tick = () => sample().catch(() => {})
  tick()
  setInterval(tick, STEP_MS).unref()
  const th = () => readThrottle().then((t) => (throttle = t))
  th()
  setInterval(th, THROTTLE_MS).unref()
  const ps = () => topProcesses().then((p) => (processes = p))
  ps()
  setInterval(ps, PROCESSES_MS).unref()
}

export async function systemStatus() {
  info ??= await loadInfo()
  if (!latest) await sample()
  return { info, now: latest!, history: { step: STEP_MS, ...history } }
}
