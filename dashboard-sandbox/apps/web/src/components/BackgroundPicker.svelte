<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { api } from '../lib/api'
  import type { DashboardConfig } from '../lib/types'
  import { view } from '../lib/viewState.svelte'

  /**
   * Choose a page's background from every scene in config/scenes. Tapping a scene previews it live
   * behind the picker (view.preview); Save writes `pages[i].sceneOverride` to dashboard.json (the page
   * then live-reloads), Cancel puts the old one back. The first option returns to the page's own
   * scene: following the prayer times on the home page.
   */
  let { config, page, names }: {
    config: DashboardConfig
    /** Index into config.pages. */
    page: number
    /** Every scene name, in gallery order. */
    names: string[]
  } = $props()

  const pc = $derived(config.pages?.[page])
  const saved = $derived(pc?.sceneOverride ?? null)
  const home = $derived(!!pc?.sceneByPrayer)
  const defaultLabel = $derived(home ? 'Follow prayer times' : `Default · ${pretty(typeof pc?.scene === 'string' ? pc.scene : '')}`)
  let saving = $state(false)

  function close() {
    view.preview = null
    view.picking = null
  }

  async function save() {
    saving = true
    const next = structuredClone($state.snapshot(config)) as DashboardConfig
    const p = next.pages?.[page]
    if (!p) return close()
    if (view.preview) p.sceneOverride = view.preview
    else delete p.sceneOverride
    await api.saveConfig(next)
    // The file watcher reloads the page; keep the preview on screen until it does.
  }
</script>

<script lang="ts" module>
  const WORDS: Record<string, string> = { aqsa: 'Al-Aqsa', farooq: 'Al-Farooq', sophia: 'Hagia Sophia' }

  /** "aqsa-fajr" → "Al-Aqsa Fajr" */
  export const pretty = (name: string) =>
    name.split('-').map((w) => WORDS[w] ?? w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
</script>

<div class="backdrop" transition:fade={{ duration: 150 }} onclick={close} role="presentation"></div>
<section class="picker panel" transition:fly={{ y: 30, duration: 260 }} aria-label="Choose a background">
  <header>▣ {home ? 'Home background' : `Background · page ${page + 1}`}</header>
  <button class="close" onclick={close} aria-label="Cancel">✕</button>

  <button class="option wide" class:on={view.preview === null} onclick={() => (view.preview = null)}>
    {defaultLabel}{#if saved === null}<small>&nbsp;· current</small>{/if}
  </button>
  <div class="grid">
    {#each names as name (name)}
      <button class="option" class:on={view.preview === name} onclick={() => (view.preview = name)}>
        {pretty(name)}{#if saved === name}<small>&nbsp;· current</small>{/if}
      </button>
    {/each}
  </div>

  <div class="actions">
    <button class="action" onclick={close}>Cancel</button>
    <button class="action save" disabled={saving || view.preview === saved} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
  </div>
</section>

<style>
  /* Clear, so the preview behind stays fully visible; it only catches taps (= Cancel) */
  .backdrop { position: absolute; inset: 0; z-index: 20; }
  .picker {
    position: absolute; z-index: 21; left: 50%; bottom: 10vh; transform: translateX(-50%);
    width: min(44rem, 92vw);
    padding: 1.5rem 1.2rem 1rem;
    display: flex; flex-direction: column; gap: 0.6rem;
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(4px);
  }
  header {
    position: absolute; top: -0.7em; left: 0.9rem; padding: 0 0.5rem; background: var(--bg);
    color: var(--accent); font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase;
  }
  button { all: unset; cursor: none; }
  .close { position: absolute; top: 0.4rem; right: 0.6rem; color: var(--muted); font-size: 1rem; padding: 0.2rem 0.4rem; }
  /* Only the list scrolls: overflow on the box itself would clip the title cut into its border */
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; max-height: 50vh; overflow-y: auto; }
  .option {
    padding: 0.65rem 0.8rem; color: var(--fg); font-size: 0.9rem;
    border: 1px solid color-mix(in srgb, var(--muted) 45%, transparent);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .option small { color: var(--muted); font-size: 0.75rem; }
  .option:active { background: color-mix(in srgb, var(--accent) 15%, transparent); }
  .option.on { border-color: #7fe3ff; color: #7fe3ff; background: color-mix(in srgb, #7fe3ff 10%, transparent); }
  .option.on::before { content: '◆ '; }
  .wide { text-align: center; }
  .actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.4rem; }
  .action { padding: 0.5rem 1.2rem; border: 1px solid var(--muted); color: var(--muted); letter-spacing: 0.06em; }
  .action.save { border-color: var(--accent); color: var(--accent); }
  .action:disabled { opacity: 0.35; }
</style>
