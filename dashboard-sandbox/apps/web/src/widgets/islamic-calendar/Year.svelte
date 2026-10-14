<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import PixelTitle from '../../components/PixelTitle.svelte'
  import { arabicDate, dateRange, daysUntil, englishDate, hijriYear, islamicEvents, relative, toHijri, upcoming } from '../../lib/hijri'
  import { view } from '../../lib/viewState.svelte'

  /**
   * The whole Hijri year, opened from the Hijri card. It slides out from the left and stops short
   * of the mataf, so the Kaaba and the tawaf stay in view. The date assembles itself in pixels on top.
   */
  let { now }: { now: Date } = $props()

  let today = $derived(toHijri(now))
  let months = $derived(hijriYear(today.year))
  let events = $derived(islamicEvents(today.year))
  let next = $derived(upcoming(1, false, now)[0])
  let width = $state(0)

  const md = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  const close = () => (view.expanded = null)
</script>

<div class="backdrop" transition:fade={{ duration: 200 }} onclick={close} role="presentation"></div>
<section class="year panel" transition:fly={{ x: -60, duration: 320 }} aria-label="Islamic calendar" bind:clientWidth={width}>
  <header>☾ {today.year} AH</header>
  <button class="close" onclick={close} aria-label="Close the Islamic calendar">✕</button>

  <div class="title">
    {#if width}
      <PixelTitle text={arabicDate(now)} subtitle={englishDate(now)} label="Today: {englishDate(now)} AH" maxWidth={width * 0.9} />
    {/if}
  </div>
  {#if next}
    <p class="next">
      Next · <b>{next.name}</b> {relative(next, now)} <span>({dateRange(next.start, next.end)})</span>
    </p>
  {/if}

  <ol class="months">
    {#each months as m (m.month)}
      {@const past = daysUntil(new Date(m.start.getTime() + (m.days - 1) * 86_400_000), now) < 0}
      {@const current = m.month === today.month}
      <li class:past class:current>
        <div class="head">
          <span class="num">{m.month}</span>
          <span class="name">{m.name}</span>
          <span class="ar">{m.nameAr}</span>
        </div>
        <div class="span">{md.format(m.start)} – {md.format(new Date(m.start.getTime() + (m.days - 1) * 86_400_000))} · {m.days} days</div>
        <ul>
          {#each events.filter((e) => e.month === m.month) as e (e.name)}
            {@const live = daysUntil(e.start, now) <= 0 && daysUntil(e.end, now) >= 0}
            <li class:minor={e.minor} class:live class:is-next={e.name === next?.name && e.start.getTime() === next.start.getTime()} title={e.note}>
              <span>{e.name}</span><span class="d">{dateRange(e.start, e.end)}</span>
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ol>
</section>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 15; background: color-mix(in srgb, var(--bg) 20%, transparent); }
  .year {
    position: fixed; z-index: 16; left: 2.5vw; top: 3.5vh; bottom: 3.5vh;
    /* Stops before the mataf (the middle ~30% of the screen) */
    width: 33vw;
    padding: 1.3rem 1.1rem 1rem;
    display: flex; flex-direction: column; gap: 0.5rem;
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
  .title { display: flex; justify-content: center; min-height: 5.5rem; }
  .next { text-align: center; color: var(--muted); font-size: 0.85rem; }
  .next b { color: var(--accent); font-weight: 600; }

  .months {
    list-style: none; flex: 1; min-height: 0;
    display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr; gap: 0.45rem;
  }
  .months > li {
    padding: 0.4rem 0.55rem; overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--muted) 40%, transparent);
    font-size: 0.74rem; line-height: 1.35;
  }
  .months > li.past { opacity: 0.45; }
  .months > li.current { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .head { display: flex; align-items: baseline; gap: 0.4rem; }
  .num { color: var(--muted); }
  .name { color: var(--fg); font-weight: 600; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .current .name { color: var(--accent); }
  .ar { font-family: var(--font-arabic); font-size: 0.95rem; color: var(--accent); line-height: 1; }
  .span { color: var(--muted); }
  ul { list-style: none; margin-top: 0.15rem; }
  ul li { display: flex; justify-content: space-between; gap: 0.5rem; color: var(--fg); }
  ul li span:first-child::before { content: '◆ '; color: var(--accent); }
  ul li.minor { color: var(--muted); }
  ul li.minor span:first-child::before { content: '◇ '; color: var(--muted); }
  ul li.live span:first-child { color: #7fe3ff; }
  ul li.is-next span:first-child { color: #ffd166; }
  .d { color: var(--muted); white-space: nowrap; }
</style>
