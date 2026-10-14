/**
 * Settings that belong to one device, not the dashboard: kept in this browser's localStorage, not
 * config/dashboard.json, so turning one on at your Mac never reaches the Pi.
 * - glass: frosted backdrop blur behind the always-on boxes (clock, Salah, verse, Background).
 *   Off by default: over the animated scene the GPU re-blurs every frame, and the Pi ran at 80 °C+.
 *   Fine on a Mac or PC.
 */

const KEY = 'dashboard:glass'

export const prefs = $state({
  glass: (() => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
  })(),
})

export function setGlass(on: boolean) {
  prefs.glass = on
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* storage blocked: this session only */ }
}
