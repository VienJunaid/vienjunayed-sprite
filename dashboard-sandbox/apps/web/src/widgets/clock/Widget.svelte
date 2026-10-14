<script lang="ts">
  import Panel from '../Panel.svelte'
  import { view } from '../../lib/viewState.svelte'
  import { englishDate } from '../../lib/hijri'
  import { is12h } from '../../lib/timeFormat'
  import { bigText } from './digits'

  // 12/24-hour comes from the shared setting (lib/timeFormat.ts), like every other time on screen
  const hour12 = is12h()

  let now = $state(new Date())
  $effect(() => {
    const id = setInterval(() => (now = new Date()), 1000)
    return () => clearInterval(id)
  })

  const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  let h = $derived(hour12 ? now.getHours() % 12 || 12 : now.getHours())
  let time = $derived(`${hour12 ? h : String(h).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
  let meridiem = $derived(hour12 ? (now.getHours() < 12 ? 'AM' : 'PM') : '')
</script>

<!-- Tapping the clock opens Settings -->
<button class="open-settings" onclick={() => (view.settingsOpen = true)} aria-label="Open settings">
<Panel title="Time" icon="◷">
  <div class="time">
    <pre>{bigText(time)}</pre>
    {#if meridiem}<span class="meridiem">{meridiem}</span>{/if}
  </div>
  <div class="date">{dateFmt.format(now)}</div>
  <div class="hijri">{englishDate(now)} AH</div>
</Panel>
</button>

<style>
  .open-settings { all: unset; display: block; cursor: none; }
  .open-settings:active :global(.panel) { border-color: var(--accent); }
  .time { display: flex; align-items: flex-end; gap: 0.6rem; color: var(--fg); }
  pre { font-family: inherit; font-size: 1.6rem; line-height: 1; letter-spacing: -0.02em; }
  .meridiem { color: var(--muted); font-size: 0.9rem; padding-bottom: 0.2rem; }
  .date { margin-top: 0.7rem; color: var(--fg); }
  .hijri { color: var(--accent); font-size: 0.9rem; }
</style>
