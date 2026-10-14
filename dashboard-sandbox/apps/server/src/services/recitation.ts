import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import { ASSETS_DIR, DATA_DIR } from '../paths.js'
import { readConfig } from './config.js'
import { prayerJustStarted } from './prayer.js'
import { recitedVerse, surahList, type Verse } from './quran.js'

// The Quran player. The server plays the recitation itself (through mpv), so the dashboard reloading
// after a settings change never cuts it off; the screen is only a remote, and follows along.
// - Audio: one MP3 per surah from mp3quran.net, saved in data/ the first time it plays.
// - Follow-along: assets/quran/recitation.json (scripts/fetch-recitation.mjs) says when each ayah
//   starts. The ayah on screen comes from quran.json, never from the audio site.
// - Prayer times: it fades out and waits for the first minutes of each prayer, then picks up again
//   at the start of the ayah it stopped on.

interface Timings {
  source: string
  reciter: { id: number; name: string; nameArabic: string; audio: string }
  /** starts[i]: when ayah i+1 begins, in ms. Before starts[0], he recites the opening Bismillah. */
  surahs: { starts: number[]; end: number }[]
}

export type Mode = 'loop' | 'continue'

export interface RecitationState {
  /** Is mpv installed on this machine? */
  available: boolean
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'prayer'
  /** The surah playing, or the one to resume. */
  surah: number | null
  /** 0 = the opening before ayah 1. */
  ayah: number
  ayahs: number
  mode: Mode
  volume: number
  /** The text being recited. */
  verse: Verse | null
  /** Waiting for a prayer: which one, and when the recitation picks up again. */
  hold: { prayer: string; until: string } | null
  error?: string
}

const STATE_FILE = path.join(DATA_DIR, 'recitation.json')
const TICK_MS = 250
/** A surah whose first ayah starts later than this has an opening (the Bismillah) before it. */
const OPENING_MS = 1500
/** Show an ayah slightly early: it covers the wait between two position checks. */
const LEAD_MS = 120

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let timings: Timings | undefined
const loadTimings = async () =>
  (timings ??= JSON.parse(await readFile(path.join(ASSETS_DIR, 'quran/recitation.json'), 'utf8')) as Timings)

// ---- mpv, controlled over its JSON IPC socket

interface MpvEvent { event: string; reason?: string }

class Mpv {
  private child?: ChildProcess
  private socket?: net.Socket
  private starting?: Promise<void>
  private spawned = 0
  private id = 0
  private waiting = new Map<number, (data: unknown) => void>()

  constructor(private onEvent: (e: MpvEvent) => void, private onExit: () => void) {}

  get alive() {
    return !!this.socket && !this.socket.destroyed
  }

  start(volume: number) {
    if (this.alive) return Promise.resolve()
    return (this.starting ??= this.spawn(volume).finally(() => (this.starting = undefined)))
  }

  private async spawn(volume: number) {
    // A new socket each time: an mpv that is still exiting removes its own on the way out
    const sock = path.join(os.tmpdir(), `rpi-dashboard-mpv-${process.pid}-${++this.spawned}.sock`)
    await rm(sock, { force: true })
    // RECITATION_MPV_ARGS: e.g. --audio-device=… to pick the speaker
    const extra = (process.env.RECITATION_MPV_ARGS ?? '').split(/\s+/).filter(Boolean)
    const child = spawn(
      'mpv',
      ['--no-config', '--no-video', '--no-terminal', '--idle=yes', '--ytdl=no', '--audio-display=no',
        `--volume=${volume}`, `--input-ipc-server=${sock}`, ...extra],
      { stdio: 'ignore' },
    )
    this.child = child
    const failed = new Promise<never>((_, reject) => child.once('error', () => reject(new Error('mpv is not installed'))))
    failed.catch(() => {})
    child.once('exit', () => {
      if (this.child !== child) return // stopped on purpose (kill)
      this.kill()
      this.onExit()
    })

    try {
      this.socket = await Promise.race([connect(sock), failed])
    } catch (e) {
      this.kill()
      throw e
    }
    let buffer = ''
    this.socket.setEncoding('utf8')
    this.socket.on('data', (chunk: string) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) if (line) this.onLine(line)
    })
    this.socket.on('error', () => {})
  }

  private onLine(line: string) {
    let msg: { event?: string; reason?: string; request_id?: number; error?: string; data?: unknown }
    try { msg = JSON.parse(line) } catch { return }
    if (msg.event) this.onEvent({ event: msg.event, reason: msg.reason })
    else if (msg.request_id !== undefined) {
      this.waiting.get(msg.request_id)?.(msg.error === 'success' ? msg.data : undefined)
      this.waiting.delete(msg.request_id)
    }
  }

  /** Resolves with the reply's data, or undefined when the command failed or mpv is gone. */
  command(...args: unknown[]): Promise<unknown> {
    return new Promise((resolve) => {
      if (!this.alive) return resolve(undefined)
      const request_id = ++this.id
      this.waiting.set(request_id, resolve)
      this.socket!.write(JSON.stringify({ command: args, request_id }) + '\n')
    })
  }

  kill() {
    const child = this.child
    this.child = undefined
    this.socket?.destroy()
    this.socket = undefined
    for (const resolve of this.waiting.values()) resolve(undefined)
    this.waiting.clear()
    child?.kill()
  }
}

async function connect(sock: string) {
  for (let i = 0; i < 60; i++) {
    try {
      return await new Promise<net.Socket>((resolve, reject) => {
        const s = net.createConnection(sock)
        s.once('connect', () => resolve(s))
        s.once('error', reject)
      })
    } catch {
      await sleep(50)
    }
  }
  throw new Error('mpv did not start')
}

let installed: boolean | undefined
const mpvInstalled = () => (installed ??= !spawnSync('mpv', ['--version'], { stdio: 'ignore' }).error)

// ---- audio files: streamed the first time, and saved for the next

const fileName = (surah: number) => `${String(surah).padStart(3, '0')}.mp3`
const audioDir = (t: Timings) => path.join(DATA_DIR, 'quran-audio', String(t.reciter.id))
const downloads = new Map<number, Promise<void>>()
let log: (message: string) => void = () => {}

function save(surah: number, t: Timings) {
  const file = path.join(audioDir(t), fileName(surah))
  if (downloads.has(surah) || existsSync(file)) return
  const job = (async () => {
    await mkdir(audioDir(t), { recursive: true })
    const res = await fetch(t.reciter.audio + fileName(surah))
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    await pipeline(Readable.fromWeb(res.body as ReadableStream), createWriteStream(`${file}.part`))
    const expected = Number(res.headers.get('content-length'))
    if (expected && (await stat(`${file}.part`)).size !== expected) throw new Error('incomplete download')
    await rename(`${file}.part`, file)
  })()
    .catch((e: Error) => log(`recitation: could not save surah ${surah}: ${e.message}`))
    .finally(() => downloads.delete(surah))
  downloads.set(surah, job)
}

// ---- the player

/** Remembered across restarts (data/recitation.json): where he was, and how it plays. */
const saved = { surah: null as number | null, ayah: 0, mode: 'continue' as Mode, volume: 100 }
let intent: 'stopped' | 'playing' | 'paused' = 'stopped'
let loading = false
/** mpv has the surah open (so pause and resume keep their place). */
let loaded = false
let source = ''
let hold: { prayer: string; until: Date } | null = null
/** "Play now" during a prayer's pause: don't hold again until that pause would have ended. */
let overrideUntil = 0
let error: string | undefined
let verse: Verse | null = null
/** The latest play() wins when surahs are tapped quickly. */
let generation = 0
let timer: NodeJS.Timeout | undefined
let ticks = 0
let busy = false
let lastSave = 0

const listeners = new Set<(state: RecitationState) => void>()
export const onRecitationChange = (fn: (state: RecitationState) => void) => void listeners.add(fn)

const mpv = new Mpv(onMpvEvent, () => {
  clearInterval(timer)
  loaded = false
  loading = false
  if (intent === 'playing') {
    intent = 'paused'
    error = 'The audio player stopped'
  }
  void publish()
})

const ready = (async () => {
  try {
    const t = await loadTimings()
    const s = JSON.parse(await readFile(STATE_FILE, 'utf8')) as Partial<typeof saved>
    if (Number.isInteger(s.surah) && s.surah! >= 1 && s.surah! <= t.surahs.length) {
      saved.surah = s.surah!
      saved.ayah = Math.min(Math.max(0, Math.trunc(Number(s.ayah) || 0)), t.surahs[s.surah! - 1].starts.length)
    }
    if (s.mode === 'loop' || s.mode === 'continue') saved.mode = s.mode
    if (Number.isFinite(s.volume)) saved.volume = Math.min(100, Math.max(0, Math.round(s.volume!)))
  } catch {
    /* nothing remembered yet */
  }
})()

export function startRecitation(logger: (message: string) => void) {
  log = logger
  // The recitation must not outlive the server
  process.once('exit', () => mpv.kill())
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => process.exit(0))
}

function persist(force: boolean) {
  if (!force && Date.now() - lastSave < 30_000) return
  lastSave = Date.now()
  mkdir(DATA_DIR, { recursive: true })
    .then(() => writeFile(STATE_FILE, JSON.stringify(saved)))
    .catch(() => {})
}

const hasOpening = (t: Timings, surah: number) => t.surahs[surah - 1].starts[0] > OPENING_MS

function ayahAt(t: Timings, surah: number, ms: number) {
  const { starts } = t.surahs[surah - 1]
  if (ms + LEAD_MS < starts[0]) return hasOpening(t, surah) ? 0 : 1
  let i = starts.length - 1
  while (i > 0 && starts[i] > ms + LEAD_MS) i--
  return i + 1
}

/** Where an ayah starts in the recording, in seconds. */
const startOf = (t: Timings, surah: number, ayah: number) => (ayah <= 0 ? 0 : t.surahs[surah - 1].starts[ayah - 1] / 1000)

export async function recitationState(): Promise<RecitationState> {
  await ready
  const t = await loadTimings()
  const { surah, ayah } = saved
  if (surah === null) verse = null
  else if (verse?.key !== `${surah}:${ayah}`) verse = (await recitedVerse(surah, ayah, hasOpening(t, surah))) ?? null
  return {
    available: mpvInstalled(),
    status: intent === 'stopped' ? 'idle' : loading ? 'loading' : intent === 'paused' ? 'paused' : hold ? 'prayer' : 'playing',
    surah,
    ayah,
    ayahs: surah === null ? 0 : t.surahs[surah - 1].starts.length,
    mode: saved.mode,
    volume: saved.volume,
    verse,
    hold: hold && { prayer: hold.prayer, until: hold.until.toISOString() },
    error,
  }
}

async function publish() {
  const state = await recitationState()
  for (const fn of listeners) fn(state)
  return state
}

/** The surah list for the picker: names, length, and whether the audio is already saved. */
export async function recitationSurahs() {
  const [list, t] = await Promise.all([surahList(), loadTimings()])
  const have = new Set(await readdir(audioDir(t)).catch(() => [] as string[]))
  return {
    reciter: t.reciter.name,
    source: t.source,
    surahs: list.map((s, i) => ({ ...s, seconds: Math.round(t.surahs[i].end / 1000), saved: have.has(fileName(s.number)) })),
  }
}

async function currentHold() {
  if (Date.now() < overrideUntil) return null
  const minutes = (await readConfig()).recitation?.prayerPauseMinutes ?? 20
  if (!(minutes > 0)) return null
  return (await prayerJustStarted(minutes).catch(() => undefined)) ?? null
}

async function fadeOut() {
  for (let i = 9; i >= 0; i--) {
    await mpv.command('set_property', 'volume', (saved.volume * i) / 10)
    await sleep(200)
  }
}

/** A prayer started: fade out and wait. Its pause ended: pick up at the start of the ayah. */
async function checkHold() {
  const next = await currentHold()
  if (next && !hold) {
    hold = next
    await publish()
    if (intent === 'playing' && loaded) {
      await fadeOut()
      await mpv.command('set_property', 'pause', true)
      await mpv.command('set_property', 'volume', saved.volume)
    }
  } else if (!next && hold) {
    hold = null
    if (intent === 'playing' && loaded && saved.surah !== null) {
      // No fade back in: it would swallow the first words of the ayah
      await mpv.command('seek', startOf(await loadTimings(), saved.surah, saved.ayah), 'absolute')
      await mpv.command('set_property', 'pause', false)
    }
    await publish()
  }
}

async function tick() {
  if (busy || !mpv.alive) return
  busy = true
  try {
    if (ticks++ % Math.round(5000 / TICK_MS) === 0) await checkHold()
    if (!loaded || loading || saved.surah === null) return
    const seconds = await mpv.command('get_property', 'time-pos')
    if (typeof seconds !== 'number' || !loaded || loading || saved.surah === null) return
    const ayah = ayahAt(await loadTimings(), saved.surah, seconds * 1000)
    if (ayah !== saved.ayah) {
      saved.ayah = ayah
      persist(false)
      await publish()
    }
  } finally {
    busy = false
  }
}

function onMpvEvent(e: MpvEvent) {
  if (e.event === 'file-loaded') {
    void (async () => {
      if ((await mpv.command('get_property', 'path')) !== source) return // an earlier tap's surah
      loaded = true
      loading = false
      await publish()
    })()
  } else if (e.event === 'end-file' && e.reason === 'eof') {
    // The end of the surah: again, or on to the next (An-Nas goes round to Al-Fatiha)
    loaded = false
    if (intent === 'playing' && saved.surah !== null && timings) {
      void play(saved.mode === 'loop' ? saved.surah : (saved.surah % timings.surahs.length) + 1)
    }
  } else if (e.event === 'end-file' && e.reason === 'error') {
    loaded = false
    loading = false
    intent = 'paused'
    error = 'Could not play this surah: no network, or no speaker'
    void publish()
  }
}

/** Play a surah from the start, or from an ayah (0 = the opening Bismillah). */
export async function play(surah: number, ayah = 0): Promise<RecitationState> {
  await ready
  const t = await loadTimings()
  if (!Number.isInteger(surah) || surah < 1 || surah > t.surahs.length) throw new Error('No such surah')
  const gen = ++generation
  saved.surah = surah
  saved.ayah = Math.min(Math.max(0, Math.trunc(ayah) || 0), t.surahs[surah - 1].starts.length)
  if (saved.ayah === 0 && !hasOpening(t, surah)) saved.ayah = 1
  intent = 'playing'
  loading = true
  loaded = false
  error = undefined
  persist(true)
  await publish()

  try {
    if (!mpvInstalled()) throw new Error('mpv is not installed')
    await mpv.start(saved.volume)
    if (gen !== generation) return recitationState()
    clearInterval(timer)
    timer = setInterval(() => void tick(), TICK_MS)
    hold = await currentHold()
    if (gen !== generation) return recitationState()

    const file = path.join(audioDir(t), fileName(surah))
    source = existsSync(file) ? file : t.reciter.audio + fileName(surah)
    save(surah, t)
    if (saved.mode === 'continue') save((surah % t.surahs.length) + 1, t)

    await mpv.command('set_property', 'pause', !!hold)
    await mpv.command('set_property', 'volume', saved.volume)
    await mpv.command('set_property', 'start', String(startOf(t, surah, saved.ayah)))
    await mpv.command('loadfile', source, 'replace')
  } catch (e) {
    if (gen === generation) {
      loading = false
      intent = 'paused'
      error = (e as Error).message
    }
  }
  return publish()
}

export async function pause() {
  await ready
  if (intent === 'stopped') return recitationState()
  intent = 'paused'
  await mpv.command('set_property', 'pause', true)
  persist(true)
  return publish()
}

/** Carry on from where it stopped. `force`: play now, even during a prayer's pause. */
export async function resume(force = false) {
  await ready
  if (saved.surah === null) return recitationState()
  if (force && hold) {
    overrideUntil = hold.until.getTime()
    hold = null
  }
  if (!loaded || !mpv.alive) return play(saved.surah, saved.ayah)
  intent = 'playing'
  error = undefined
  if (!hold) await mpv.command('set_property', 'pause', false)
  return publish()
}

/** Stop: the verse box goes back to the daily verses. The place is remembered. */
export async function stop() {
  await ready
  generation++
  intent = 'stopped'
  loading = false
  loaded = false
  error = undefined
  clearInterval(timer)
  mpv.kill()
  persist(true)
  return publish()
}

export async function setMode(mode: Mode) {
  await ready
  saved.mode = mode
  if (mode === 'continue' && saved.surah !== null && intent !== 'stopped') {
    const t = await loadTimings()
    save((saved.surah % t.surahs.length) + 1, t)
  }
  persist(true)
  return publish()
}

export async function setVolume(volume: number) {
  await ready
  saved.volume = Math.min(100, Math.max(0, Math.round(volume)))
  await mpv.command('set_property', 'volume', saved.volume)
  persist(true)
  return publish()
}
