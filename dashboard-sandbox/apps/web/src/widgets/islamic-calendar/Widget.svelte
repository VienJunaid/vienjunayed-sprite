<script lang="ts">
  import SideCard from '../SideCard.svelte'
  import type { CardItem } from '../types'
  import { arabicDate, dateRange, englishDate, relative, upcoming } from '../../lib/hijri'
  import { view } from '../../lib/viewState.svelte'
  import Year from './Year.svelte'

  // Hijri date and the next important days. Tap it to open the whole Islamic year.
  let now = $state(new Date())
  $effect(() => {
    const id = setInterval(() => (now = new Date()), 60_000)
    return () => clearInterval(id)
  })

  let items = $derived<CardItem[]>(
    [...upcoming(3, false, now), ...upcoming(1, true, now)].map((e) => ({
      key: e.name + e.start.getTime(),
      name: e.name,
      when: `${dateRange(e.start, e.end)} · ${relative(e, now)}`,
      quiet: e.minor,
    })),
  )
</script>

<SideCard title="Hijri" icon="☾" small="{englishDate(now)} AH" {items} more="the year" label="Open the Islamic calendar" onopen={() => (view.expanded = 'hijri')}>
  {#snippet big()}<span class="ar">{arabicDate(now)}</span>{/snippet}
</SideCard>

{#if view.expanded === 'hijri'}<Year {now} />{/if}

<style>
  .ar { font-family: var(--font-arabic); font-size: 1.5rem; direction: rtl; }
</style>
