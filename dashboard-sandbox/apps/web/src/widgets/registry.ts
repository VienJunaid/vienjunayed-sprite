import type { WidgetManifest } from './types'
import calendar from './calendar/manifest'
import clock from './clock/manifest'
import islamicCalendar from './islamic-calendar/manifest'
import nextPage from './next-page/manifest'
import prayerTimes from './prayer-times/manifest'
import spotify from './spotify/manifest'
import systemHealth from './system-health/manifest'

// To add a widget: create widgets/<id>/{manifest.ts,Widget.svelte}, import it here,
// then list it in config/dashboard.json → widgets.
export const widgets: Record<string, WidgetManifest> = Object.fromEntries(
  [clock, prayerTimes, spotify, nextPage, islamicCalendar, calendar, systemHealth].map((w) => [w.id, w]),
)
