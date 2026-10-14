<script lang="ts">
  import type { Snippet } from 'svelte'

  // Omarchy / Waybar-style box: thin border with the title cut into the top edge.
  let { title, icon = '', children }: { title: string; icon?: string; children: Snippet } = $props()
</script>

<section class="panel">
  <header><span class="icon">{icon}</span>{title}</header>
  {@render children()}
</section>

<style>
  .panel {
    position: relative;
    min-width: 16rem;
    padding: 1.1rem 1.2rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--muted) 80%, transparent);
    /* No backdrop blur by default: over a canvas that changes every frame, the GPU re-blurs it at
       the full frame rate all day (the Pi ran at 80 °C+). Slightly more opaque instead. */
    background: color-mix(in srgb, var(--bg) 86%, transparent);
  }
  /* Glass blur setting (lib/prefs.svelte.ts, per device): frosted, for a Mac or PC */
  :global(html.glass) .panel { background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(2px); }
  header {
    position: absolute;
    top: -0.7em;
    left: 0.9rem;
    padding: 0 0.5rem;
    background: var(--bg);
    color: var(--accent);
    font-size: 0.85rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .icon:not(:empty) { margin-right: 0.45rem; }
</style>
