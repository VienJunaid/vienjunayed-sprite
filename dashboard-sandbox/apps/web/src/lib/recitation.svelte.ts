import { serverEvents } from './api'

/**
 * The Quran player, as the screen sees it. The server plays the audio (so a page reload never cuts
 * the recitation off) and pushes its state here on every change: a new ayah, pause, a prayer's
 * pause. Nothing is polled. The verse box, the player panel and the sleep screen all read this.
 */

export interface RecitedVerse {
  key: string
  surah: { number: number; name: string; englishName: string; translatedName: string }
  /** 0 = the opening before ayah 1 (the Bismillah). */
  ayah: number
  arabic: string
  bismillah: string | null
  translation: string
}

export type RecitationMode = 'loop' | 'continue'

export interface RecitationState {
  /** Is the audio player (mpv) installed on the machine running the server? */
  available: boolean
  /** prayer: waiting out the first minutes of a prayer. idle: stopped (the place is remembered). */
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'prayer'
  surah: number | null
  ayah: number
  ayahs: number
  mode: RecitationMode
  volume: number
  verse: RecitedVerse | null
  hold: { prayer: string; until: string } | null
  error?: string
}

export interface SurahInfo {
  number: number
  name: string
  englishName: string
  translatedName: string
  ayahs: number
  seconds: number
  /** The audio is already on this machine (it plays offline). */
  saved: boolean
}

export const recitation = $state<{ now: RecitationState | null }>({ now: null })

/** Follow the server's player: its state now, then each change as it happens. */
export function watchRecitation() {
  const refresh = async () => {
    try {
      const res = await fetch('/api/recitation')
      if (res.ok) recitation.now = await res.json()
    } catch {
      /* keep what we have */
    }
  }
  const onState = (e: MessageEvent<string>) => (recitation.now = JSON.parse(e.data))
  const events = serverEvents()
  events.addEventListener('recitation', onState)
  events.addEventListener('open', refresh) // also catches up after the server restarts
  refresh()
  return () => {
    events.removeEventListener('recitation', onState)
    events.removeEventListener('open', refresh)
  }
}

async function send(action: string, body: object = {}) {
  try {
    const res = await fetch(`/api/recitation/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) recitation.now = await res.json()
  } catch {
    /* the server is away; the state stays as it was */
  }
}

export const recite = {
  /** From the start of the surah, or from an ayah. */
  play: (surah: number, ayah = 0) => send('play', { surah, ayah }),
  pause: () => send('pause'),
  /** `force`: play now, even during a prayer's pause. */
  resume: (force = false) => send('resume', { force }),
  stop: () => send('stop'),
  mode: (mode: RecitationMode) => send('mode', { mode }),
  volume: (volume: number) => send('volume', { volume }),
}

export const surahs = () =>
  fetch('/api/recitation/surahs').then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<{ reciter: string; source: string; surahs: SurahInfo[] }>
  })
