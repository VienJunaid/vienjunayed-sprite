import type { Prayer } from './prayerClock'

/**
 * UI state shared between widgets, overlays and the scene.
 * - selected: prayer scene picked by tapping it in the Salah widget (null = follow the real time)
 * - settingsOpen: the settings panel (opened by tapping the clock)
 * - scenery: scenery-only mode — just the pixel art, tap left/right to browse every scene
 * - expanded: a side card opened into its big view (Haram page: Islamic year, personal calendar)
 * - picking: the page whose background is being chosen (BackgroundPicker), or null
 * - preview: the scene shown on that page while choosing (null = the page's own scene)
 * - quran: the Quran player (QuranPlayer), opened by tapping the verse box
 * - sleeping: sleep mode (SleepScreen): black, the time and next prayer only. It survives a live
 *   reload (e.g. an update landing overnight), so the screen doesn't light back up by itself.
 * - wallpaper: `?wallpaper` mode — pinned behind everything else by hyprwinwrap as the desktop
 *   background. The UI is otherwise normal (widgets and taps work) since hyprwinwrap itself gates
 *   whether clicks reach the window at all (`hyprwinwrap_interactivity`, bound to a hotkey) — it's
 *   click-through wallpaper until toggled, then a fully interactive dashboard. The page can also be
 *   driven externally (e.g. an Omarchy workspace switch) over the same SSE channel as live reload.
 */
export const view = $state<{
  selected: Prayer | null
  settingsOpen: boolean
  scenery: boolean
  expanded: 'hijri' | 'calendar' | null
  picking: number | null
  preview: string | null
  quran: boolean
  sleeping: boolean
  wallpaper: boolean
}>({
  selected: null,
  settingsOpen: false,
  scenery: false,
  expanded: null,
  picking: null,
  preview: null,
  quran: false,
  sleeping: (() => {
    try { return sessionStorage.getItem('dashboard:sleep') === '1' } catch { return false }
  })(),
  wallpaper: (() => {
    try { return new URLSearchParams(location.search).has('wallpaper') } catch { return false }
  })(),
})

/** Sleep mode: close whatever is open and go dark. */
export function goToSleep() {
  view.settingsOpen = false
  view.expanded = null
  view.picking = null
  view.preview = null
  view.quran = false
  view.sleeping = true
}

/** Open the background picker for `page`, previewing its saved choice so the screen doesn't change. */
export function pickBackground(page: number, saved: string | undefined) {
  view.settingsOpen = false
  view.preview = saved ?? null
  view.picking = page
}

/** Tap a prayer: show its scene; tap it again (or the live prayer) to go back to live. */
export function togglePrayer(p: Prayer, live: Prayer | undefined) {
  view.selected = view.selected === p || p === live ? null : p
}
