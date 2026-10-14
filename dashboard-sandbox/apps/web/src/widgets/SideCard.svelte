<script lang="ts">
  import type { Snippet } from 'svelte'
  import Panel from './Panel.svelte'
  import type { CardItem } from './types'

  /**
   * The tappable card shape shared by the Hijri and Calendar cards on the Haram page, so the pair
   * match: a big line, a small line, a list of two-line items, and "▸" at the bottom. It fills its
   * area (see .rooftop-* in App.svelte), and tapping it opens the big view.
   */
  let { title, icon, big, small, items, more, onopen, label, children }: {
    title: string
    icon: string
    /** Top line: the Arabic date, or today's date. */
    big: Snippet
    small: string
    items: CardItem[]
    more: string
    onopen: () => void
    label: string
    /** Shown instead of the list (loading, setup hints). */
    children?: Snippet
  } = $props()
</script>

<button class="card" onclick={onopen} aria-label={label}>
  <Panel {title} {icon}>
    <div class="big">{@render big()}</div>
    <div class="small">{small}</div>
    <hr />
    {#if children}
      <div class="note">{@render children()}</div>
    {:else}
      <ul>
        {#each items as it (it.key)}
          <li class:quiet={it.quiet}>
            <span class="name"><i style:color={it.color}>{it.quiet ? '◇' : '◆'}</i>{it.name}</span>
            <span class="when">{it.when}</span>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="more">{more} ▸</div>
  </Panel>
</button>

<style>
  .card { all: unset; display: block; width: 100%; height: 100%; cursor: none; }
  .card :global(.panel) { width: 100%; height: 100%; min-width: 0; display: flex; flex-direction: column; }
  .card:active :global(.panel) { border-color: var(--accent); }
  /* One shared baseline for the top line, whatever the font: the row's own (mono) line sets it, and
     a child in another font (Amiri's tall metrics) sits on it without stretching the row. Centering
     each font instead put the Arabic lower than the Latin, and the cards looked out of line. */
  .big { height: 2.4rem; line-height: 2.4rem; color: var(--accent); font-size: 1.35rem; white-space: nowrap; overflow: hidden; }
  .big > :global(*) { line-height: 0; }
  .small { color: var(--fg); font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  hr { border: 0; border-top: 1px dashed color-mix(in srgb, var(--muted) 60%, transparent); margin: 0.8rem 0 0.7rem; }
  ul { list-style: none; display: flex; flex-direction: column; gap: 0.55rem; min-height: 0; overflow: hidden; }
  li { display: flex; flex-direction: column; }
  .name { color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  i { font-style: normal; color: var(--accent); margin-right: 0.5em; }
  .quiet .name { color: color-mix(in srgb, var(--fg) 75%, var(--muted)); }
  .quiet i { color: var(--muted); }
  .when { color: var(--muted); font-size: 0.8rem; padding-left: 1.5em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .note { color: var(--muted); line-height: 1.5; font-size: 0.88rem; }
  .more { margin-top: auto; padding-top: 0.6rem; text-align: right; color: var(--accent); font-size: 0.78rem; letter-spacing: 0.08em; }
</style>
