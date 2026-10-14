<script lang="ts">
  import { navigate } from '../../lib/pages'

  let { options = {} }: { options?: Record<string, unknown> } = $props()
  const label = $derived(typeof options.label === 'string' ? options.label : 'next')
</script>

<button onclick={(e) => { e.stopPropagation(); navigate('next') }} aria-label="Next page">
  <span class="label">{label}</span>
  <span class="arrows" aria-hidden="true"><span>▸</span><span>▸</span><span>▸</span></span>
</button>

<style>
  button {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.7rem 1.1rem;
    font: inherit;
    font-size: 1rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--fg);
    cursor: none;
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    backdrop-filter: blur(2px);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--bg) 30%, transparent);
  }
  button:active { transform: translateY(1px); background: color-mix(in srgb, var(--accent) 25%, var(--bg)); }
  .arrows { display: flex; color: var(--accent); }
  /* Chevrons light up one after another, pointing the way */
  .arrows span { animation: pulse 1.6s steps(1) infinite; opacity: 0.3; }
  .arrows span:nth-child(2) { animation-delay: 0.2s; }
  .arrows span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0.3; } }
</style>
