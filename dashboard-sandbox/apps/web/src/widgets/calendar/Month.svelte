<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import PixelTitle from '../../components/PixelTitle.svelte'
  import { MONTHS, MONTHS_SHORT, toHijri } from '../../lib/hijri'
  import { view } from '../../lib/viewState.svelte'
  import { addDays, agenda, CAL_COLORS, dayLabel, dayStart, onDay, sameDay, timeLabel, type CalEvent } from './events'

  /**
   * The month view, opened from the Calendar card. It slides out from the right and stops short of
   * the mataf. The month assembles itself in pixels on top, like the Hijri date on the left. Each day
   * also shows its Hijri date; tap a day to list its events.
   */
  let { events, calendars, now }: { events: CalEvent[]; calendars: { name: string }[]; now: Date } = $props()

  // Month shown, relative to this month. The server sends about 40 days back and 100 ahead.
  let shift = $state(0)
  let picked = $state<Date | null>(null)
  let width = $state(0)

  let first = $derived(new Date(now.getFullYear(), now.getMonth() + shift, 1))
  let cells = $derived(Array.from({ length: 42 }, (_, i) => addDays(first, i - first.getDay())))
  let weeks = $derived(cells[35].getMonth() === first.getMonth() ? 6 : 5)
  let hijriSpan = $derived.by(() => {
    const a = toHijri(first), b = toHijri(new Date(first.getFullYear(), first.getMonth() + 1, 0))
    return a.month === b.month ? `${MONTHS[a.month - 1]} ${a.year}` : `${MONTHS[a.month - 1]} – ${MONTHS[b.month - 1]} ${b.year}`
  })

  const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
  const close = () => (view.expanded = null)
  const go = (d: number) => { shift = Math.max(-1, Math.min(2, shift + d)); picked = null }
</script>

<div class="backdrop" transition:fade={{ duration: 200 }} onclick={close} role="presentation"></div>
<section class="month panel" transition:fly={{ x: 60, duration: 320 }} aria-label="Calendar" bind:clientWidth={width}>
  <header>▦ Calendar</header>
  <button class="close" onclick={close} aria-label="Close the calendar">✕</button>

  <div class="nav">
    <button onclick={() => go(-1)} disabled={shift <= -1} aria-label="Previous month">◀</button>
    <div class="label">
      {#if width}
        <!-- Replays for each month you step to -->
        {#key first.getTime()}
          <PixelTitle text={monthFmt.format(first)} subtitle="{hijriSpan} AH" label={monthFmt.format(first)} maxWidth={width * 0.7} />
        {/key}
      {/if}
    </div>
    <button onclick={() => go(1)} disabled={shift >= 2} aria-label="Next month">▶</button>
  </div>

  <div class="grid">
    {#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as d, i (i)}<span class="dow" class:fri={i === 5}>{d}</span>{/each}
    {#each cells.slice(0, weeks * 7) as d (d.getTime())}
      {@const list = onDay(events, d)}
      {@const h = toHijri(d)}
      <button
        class="cell"
        class:out={d.getMonth() !== first.getMonth()}
        class:today={sameDay(d, now)}
        class:picked={picked && sameDay(d, picked)}
        class:white={h.day >= 13 && h.day <= 15 && h.month !== 9 && h.month !== 12}
        onclick={() => (picked = picked && sameDay(d, picked) ? null : d)}
        aria-label={dayLabel(d, now)}
      >
        <span class="n">{d.getDate()}</span>
        <span class="h" class:new={h.day === 1}>{h.day === 1 ? `1 ${MONTHS_SHORT[h.month - 1]}` : h.day}</span>
        <span class="dots">
          {#each list.slice(0, 3) as e (e.title + e.start.getTime())}<i style:background={CAL_COLORS[e.calendar % CAL_COLORS.length]}></i>{/each}
        </span>
      </button>
    {/each}
  </div>

  <div class="agenda">
    {#if picked}
      {@const list = onDay(events, picked)}
      <div class="day">{dayLabel(picked, now)} · {toHijri(picked).day} {MONTHS[toHijri(picked).month - 1]}</div>
      {#if !list.length}<p class="dim">Nothing planned</p>{/if}
      <ul>
        {#each list as e (e.title + e.start.getTime())}
          <li>
            <span class="dot" style:color={CAL_COLORS[e.calendar % CAL_COLORS.length]}>●</span>
            <span class="t">{timeLabel(e)}</span>
            <span class="title">{e.title}{#if e.location}<small>&nbsp;· {e.location}</small>{/if}</span>
          </li>
        {/each}
      </ul>
    {:else}
      {@const groups = agenda(events, 21, 12, now)}
      {#if !groups.length}<p class="dim">Nothing in the next three weeks</p>{/if}
      {#each groups as g (g.day.getTime())}
        <div class="day">{dayLabel(g.day, now)}</div>
        <ul>
          {#each g.events as e (e.title + e.start.getTime())}
            <li>
              <span class="dot" style:color={CAL_COLORS[e.calendar % CAL_COLORS.length]}>●</span>
              <span class="t">{timeLabel(e)}</span>
              <span class="title">{e.title}{#if e.location}<small>&nbsp;· {e.location}</small>{/if}</span>
            </li>
          {/each}
        </ul>
      {/each}
    {/if}
  </div>

  {#if calendars.length > 1}
    <div class="legend">
      {#each calendars as c, i (i)}<span><i style:background={CAL_COLORS[i % CAL_COLORS.length]}></i>{c.name}</span>{/each}
    </div>
  {/if}
</section>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 15; background: color-mix(in srgb, var(--bg) 20%, transparent); }
  .month {
    position: fixed; z-index: 16; right: 2.5vw; top: 3.5vh; bottom: 3.5vh;
    /* Stops before the mataf (the middle ~30% of the screen) */
    width: 33vw;
    padding: 1.3rem 1.1rem 1rem;
    display: flex; flex-direction: column; gap: 0.7rem;
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
    background: color-mix(in srgb, var(--bg) 90%, transparent);
    backdrop-filter: blur(4px);
  }
  header {
    position: absolute; top: -0.7em; left: 0.9rem; padding: 0 0.5rem; background: var(--bg);
    color: var(--accent); font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase;
  }
  button { all: unset; cursor: none; }
  .close { position: absolute; top: 0.4rem; right: 0.6rem; color: var(--muted); font-size: 1rem; padding: 0.2rem 0.4rem; }

  .nav { display: flex; align-items: center; gap: 1rem; margin-top: 0.3rem; }
  .nav button { color: var(--accent); padding: 0.4rem 0.7rem; border: 1px solid color-mix(in srgb, var(--muted) 45%, transparent); }
  .nav button:disabled { opacity: 0.25; }
  /* One grid cell, so the old month fading out and the new one flying in stack instead of sitting side by side */
  .label { flex: 1; min-width: 0; min-height: 5.5rem; display: grid; place-items: center; }
  .label > :global(*) { grid-area: 1 / 1; }

  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem; }
  .dow { text-align: center; color: var(--muted); font-size: 0.72rem; }
  .dow.fri { color: var(--accent); }
  .cell {
    position: relative; height: 3.3rem; padding: 0.25rem 0.35rem;
    border: 1px solid color-mix(in srgb, var(--muted) 30%, transparent);
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .cell.out { opacity: 0.35; }
  .cell.white { background: color-mix(in srgb, var(--fg) 6%, transparent); }
  .cell.today { border-color: #ffd166; }
  .cell.today .n { color: #ffd166; }
  .cell.picked { border-color: #7fe3ff; background: color-mix(in srgb, #7fe3ff 12%, transparent); }
  .n { color: var(--fg); font-size: 0.9rem; }
  .h { position: absolute; top: 0.25rem; right: 0.35rem; color: var(--muted); font-size: 0.62rem; }
  /* A new Hijri month is labelled in the bottom corner, clear of the date */
  .h.new { color: var(--accent); top: auto; bottom: 0.2rem; }
  .dots { display: flex; gap: 3px; height: 5px; }
  .dots i, .legend i { display: inline-block; width: 5px; height: 5px; }

  .agenda { flex: 1; min-height: 0; overflow: hidden; }
  .day { color: var(--accent); font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 0.5rem; }
  .day:first-child { margin-top: 0; }
  ul { list-style: none; }
  li { display: flex; gap: 0.5rem; align-items: baseline; font-size: 0.85rem; line-height: 1.5; }
  .dot { font-size: 0.6rem; }
  .t { color: var(--muted); min-width: 4.6rem; white-space: nowrap; }
  .title { color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .title small { color: var(--muted); }
  .dim { color: var(--muted); }
  .legend { display: flex; gap: 1rem; color: var(--muted); font-size: 0.75rem; }
  .legend i { margin-right: 0.35rem; }
</style>
