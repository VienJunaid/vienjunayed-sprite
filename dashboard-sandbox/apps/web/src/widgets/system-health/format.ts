/** Formatting and tiny text charts for the System page (btop-style: block characters, no canvas). */

export function bytes(n: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

export const rate = (n: number | null) => (n === null ? '—' : `${bytes(n)}/s`)

/** 273000 s → "3d 3h", 7500 → "2h 5m", 90 → "1m" */
export function duration(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${Math.max(1, m)}m`
}

export function ago(ms: number, now = Date.now()) {
  const s = Math.max(0, (now - ms) / 1000)
  return s < 60 ? 'just now' : `${duration(s)} ago`
}

/** "████████░░░░" */
export function bar(fraction: number, width: number) {
  const n = Math.round(Math.max(0, Math.min(1, fraction)) * width)
  return '█'.repeat(n) + '░'.repeat(width - n)
}

export type Level = 'ok' | 'warn' | 'hot' | 'bad'

export const LEVEL_COLORS: Record<Level, string> = { ok: '#9ece6a', warn: '#ffd166', hot: '#ff9e64', bad: '#f7768e' }

/** Pi 5 soft-throttles at 80–85 °C. */
export const tempLevel = (c: number): Level => (c < 60 ? 'ok' : c < 70 ? 'warn' : c < 80 ? 'hot' : 'bad')
export const usageLevel = (f: number): Level => (f < 0.7 ? 'ok' : f < 0.85 ? 'warn' : f < 0.95 ? 'hot' : 'bad')

/** Wi-Fi signal in dBm → 1–4 bars and a word. */
export function wifi(dbm: number) {
  const n = dbm > -55 ? 4 : dbm > -67 ? 3 : dbm > -75 ? 2 : 1
  return { bars: '▂▄▆█'.slice(0, n).padEnd(4, '·'), word: ['weak', 'fair', 'good', 'excellent'][n - 1] }
}
