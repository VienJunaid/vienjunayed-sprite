<script lang="ts">
  import SideCard from '../SideCard.svelte'
  import type { CardItem } from '../types'
  import { view } from '../../lib/viewState.svelte'
  import { agenda, CAL_COLORS, dayLabel, fetchCalendar, timeLabel, type CalFeed } from './events'
  import Month from './Month.svelte'

  // Your Google Calendar (read from its secret iCal link). Tap it to open the month.
  let feed = $state<CalFeed>()
  let error = $state('')
  let now = $state(new Date())

  async function load() {
    try {
      feed = await fetchCalendar()
      error = ''
    } catch (e) {
      error = (e as Error).message
    }
  }

  $effect(() => {
    load()
    const refresh = setInterval(load, 5 * 60_000) // the server re-reads Google every 10 min
    const tick = setInterval(() => (now = new Date()), 60_000)
    return () => { clearInterval(refresh); clearInterval(tick) }
  })

  const bigFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
  const smallFmt = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

  let items = $derived<CardItem[]>(
    feed
      ? agenda(feed.events, 30, 4, now).flatMap((g) =>
          g.events.map((e) => ({
            key: e.title + e.start.getTime(),
            name: e.title,
            when: `${dayLabel(g.day, now)} · ${timeLabel(e)}`,
            color: CAL_COLORS[e.calendar % CAL_COLORS.length],
          })),
        )
      : [],
  )
  let note = $derived(
    error && !feed ? `Calendar unavailable (${error})`
    : !feed ? 'loading…'
    : !feed.configured ? "Add your Google Calendar's secret iCal address to .env as CALENDAR_ICS"
    : !items.length ? 'Nothing in the next month'
    : '',
  )
</script>

<SideCard
  title="Calendar"
  icon="▦"
  small={smallFmt.format(now) + (feed?.error ? ' · offline' : '')}
  {items}
  more="the month"
  label="Open the calendar"
  onopen={() => (view.expanded = 'calendar')}
  children={note ? noteSnippet : undefined}
>
  {#snippet big()}{bigFmt.format(now)}{/snippet}
</SideCard>

{#snippet noteSnippet()}{note}{/snippet}

{#if view.expanded === 'calendar'}<Month events={feed?.events ?? []} calendars={feed?.calendars ?? []} {now} />{/if}
