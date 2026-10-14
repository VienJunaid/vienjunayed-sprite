/** Personal calendar events from GET /api/calendar/events (secret iCal links in .env). */

import { formatTime } from '../../lib/timeFormat'

export interface CalEvent {
  title: string
  start: Date
  /** Exclusive: all-day events end at midnight after their last day. */
  end: Date
  allDay: boolean
  location?: string
  calendar: number
}

export interface CalFeed {
  configured: boolean
  calendars: { name: string }[]
  events: CalEvent[]
  error?: string
}

/** One color per calendar (yours, your wife's, …). */
export const CAL_COLORS = ['var(--accent)', '#7fe3ff', '#ff9eb5', '#a6e3a1']

const DAY = 86_400_000

// All-day dates are plain YYYY-MM-DD: read them as local days, not UTC midnight
const parse = (s: string) => {
  if (s.length !== 10) return new Date(s)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export async function fetchCalendar(): Promise<CalFeed> {
  const res = await fetch('/api/calendar/events')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as Omit<CalFeed, 'events'> & { events: (Omit<CalEvent, 'start' | 'end'> & { start: string; end: string })[] }
  return { ...body, events: body.events.map((e) => ({ ...e, start: parse(e.start), end: parse(e.end) })) }
}

export const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const sameDay = (a: Date, b: Date) => dayStart(a).getTime() === dayStart(b).getTime()

/** Events that touch the day `d`. */
export const onDay = (events: CalEvent[], d: Date) => {
  const s = dayStart(d), e = addDays(s, 1)
  return events.filter((ev) => ev.start < e && ev.end > s)
}

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export const timeLabel = (e: CalEvent) => (e.allDay ? 'all day' : formatTime(e.start))

/** "Today", "Tomorrow", "Wed, Oct 1" */
export function dayLabel(d: Date, now = new Date()) {
  const n = Math.round((dayStart(d).getTime() - dayStart(now).getTime()) / DAY)
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : dayFmt.format(d)
}

/** Upcoming events grouped by day, starting today (an event already under way counts as today). */
export function agenda(events: CalEvent[], days: number, limit: number, now = new Date()) {
  const groups: { day: Date; events: CalEvent[] }[] = []
  let count = 0
  for (let i = 0; i < days && count < limit; i++) {
    const day = addDays(dayStart(now), i)
    const list = onDay(events, day).filter((e) => (i === 0 ? e.end > now : e.start >= day || e.allDay))
    if (!list.length) continue
    groups.push({ day, events: list.slice(0, limit - count) })
    count += list.length
  }
  return groups
}
