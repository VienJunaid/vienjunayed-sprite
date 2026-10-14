import ICAL from 'ical.js'

// Personal calendars from secret iCal links (Google Calendar → Settings → your calendar →
// "Secret address in iCal format"). Read-only, no OAuth. The links are passwords: they live in .env
// and are never logged or sent to the browser.

export interface CalendarEvent {
  title: string
  /** ISO time, or YYYY-MM-DD for all-day events. */
  start: string
  /** ISO time, or YYYY-MM-DD (exclusive) for all-day events. */
  end: string
  allDay: boolean
  location?: string
  /** Index into `calendars`. */
  calendar: number
}

export interface CalendarFeed {
  configured: boolean
  calendars: { name: string }[]
  events: CalendarEvent[]
  /** When the feeds were last read successfully. */
  updated?: string
  error?: string
}

const TTL = 10 * 60_000
const PAST_DAYS = 40 // covers the whole current month in the month view
const FUTURE_DAYS = 100 // the month view browses up to two months ahead
const MAX_OCCURRENCES = 2000

/** CALENDAR_ICS: one or more secret iCal links, comma-separated. */
export const feedUrls = () =>
  (process.env.CALENDAR_ICS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

const pad = (n: number) => String(n).padStart(2, '0')
const toOut = (t: ICAL.Time) => (t.isDate ? `${t.year}-${pad(t.month)}-${pad(t.day)}` : t.toJSDate().toISOString())

function parseFeed(text: string, index: number, from: Date, to: Date) {
  const root = new ICAL.Component(ICAL.parse(text))
  for (const tz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz)
  const name = String(root.getFirstPropertyValue('x-wr-calname') ?? `Calendar ${index + 1}`)

  const rangeStart = ICAL.Time.fromJSDate(from, true)
  const rangeEnd = ICAL.Time.fromJSDate(to, true)

  // Recurring events: edited occurrences arrive as separate VEVENTs with a RECURRENCE-ID
  const masters = new Map<string, ICAL.Event>()
  const exceptions: ICAL.Event[] = []
  for (const vevent of root.getAllSubcomponents('vevent')) {
    if (vevent.getFirstPropertyValue('status') === 'CANCELLED' && !vevent.hasProperty('recurrence-id')) continue
    const ev = new ICAL.Event(vevent)
    if (ev.isRecurrenceException()) exceptions.push(ev)
    else masters.set(ev.uid, ev)
  }
  for (const ex of exceptions) masters.get(ex.uid)?.relateException(ex)

  const events: CalendarEvent[] = []
  const push = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
    if (end.compare(rangeStart) <= 0 || start.compare(rangeEnd) >= 0) return
    if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return
    events.push({
      title: item.summary || '(no title)',
      start: toOut(start),
      end: toOut(end),
      allDay: start.isDate,
      location: item.location || undefined,
      calendar: index,
    })
  }

  for (const ev of masters.values()) {
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate ?? ev.startDate)
      continue
    }
    const it = ev.iterator()
    for (let i = 0, next = it.next(); next && i < MAX_OCCURRENCES; i++, next = it.next()) {
      if (next.compare(rangeEnd) >= 0) break
      const d = ev.getOccurrenceDetails(next)
      push(d.item, d.startDate, d.endDate)
    }
  }
  return { name, events }
}

let cache: { at: number; feed: CalendarFeed } | undefined
let pending: Promise<CalendarFeed> | undefined

async function load(): Promise<CalendarFeed> {
  const urls = feedUrls()
  const from = new Date(Date.now() - PAST_DAYS * 86_400_000)
  const to = new Date(Date.now() + FUTURE_DAYS * 86_400_000)
  const results = await Promise.all(
    urls.map(async (url, i) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      // Only the status: the URL itself is secret
      if (!res.ok) throw new Error(`calendar ${i + 1}: HTTP ${res.status}`)
      return parseFeed(await res.text(), i, from, to)
    }),
  )
  return {
    configured: true,
    calendars: results.map((r) => ({ name: r.name })),
    events: results.flatMap((r) => r.events).sort((a, b) => a.start.localeCompare(b.start)),
    updated: new Date().toISOString(),
  }
}

/** Cached for 10 minutes. On failure, the last good copy is served with an `error`. */
export async function calendarFeed(): Promise<CalendarFeed> {
  if (!feedUrls().length) return { configured: false, calendars: [], events: [] }
  if (cache && Date.now() - cache.at < TTL) return cache.feed
  pending ??= load()
    .then((feed) => {
      cache = { at: Date.now(), feed }
      return feed
    })
    .catch((e: Error) => {
      const stale = cache?.feed ?? { configured: true, calendars: [], events: [] }
      // Retry in a minute rather than hammering Google on every request
      cache = { at: Date.now() - TTL + 60_000, feed: { ...stale, error: e.message } }
      return cache.feed
    })
    .finally(() => (pending = undefined))
  return pending
}

/** For the System page: is it set up, when did it last sync, and is it failing? (No fetch.) */
export const calendarStatus = () => ({
  configured: feedUrls().length > 0,
  updated: cache?.feed.updated,
  error: cache?.feed.error,
})
