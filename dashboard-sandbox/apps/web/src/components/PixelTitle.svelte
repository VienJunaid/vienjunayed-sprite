<script lang="ts">
  import { fade } from 'svelte/transition'
  import { hash } from '../scene/pixels'

  /**
   * A title that assembles itself out of pixels: the text is rasterized into a small pixel grid, then
   * every pixel flies in from the sky along an arc and settles into place, in reading order (right to
   * left for Arabic). Once assembled, a gold light sweeps across it and a few stars twinkle.
   * Used for "a prayer just started", the Hijri date, and the month in the personal calendar.
   */
  let { text, subtitle, label, boxed = false, maxWidth, scale = 1 }: {
    /** Arabic (Amiri Quran) or Latin (JetBrains Mono, upper-cased). */
    text: string
    /** Line under the Arabic, e.g. "TIME FOR ASR" or "ASR · 4:52 PM". */
    subtitle: string
    /** Accessible name. */
    label: string
    /** Frosted box of its own (used when it takes the verse's place). */
    boxed?: boolean
    /** Widest the canvas may be, in CSS px (the pixels get smaller to fit). */
    maxWidth?: number
    /** Bigger pixels (the sleep screen's clock uses 2). */
    scale?: number
  } = $props()
  let canvas: HTMLCanvasElement

  const GOLD = ['#9c6a22', '#c8912f', '#e2b24a', '#f6d27a', '#fff3c4']
  const CREAM = ['#cdbfae', '#e6dccd', '#f6efe4', '#ffffff']

  $effect(() => {
    let raf = 0
    let stopped = false
    const rtl = /[\u0600-\u06FF]/.test(text)
    const line1 = rtl ? text : text.toUpperCase()
    const font1 = rtl ? '32px "Amiri Quran"' : '700 22px "JetBrains Mono"'
    const line2 = subtitle.toUpperCase().split('').join(' ')

    ;(async () => {
      await Promise.all([document.fonts.load(font1), document.fonts.load('600 9px "JetBrains Mono"')]).catch(() => {})
      if (stopped) return

      // 1. Rasterize the text at low resolution: every opaque pixel becomes a particle target
      const src = document.createElement('canvas')
      const c = src.getContext('2d', { willReadFrequently: true })!
      c.font = font1
      const arMetrics = c.measureText(line1)
      // The subtitle sits below the title's lowest descender (the tail of ي in ربيع reaches far down)
      const arBottom = 30 + Math.max(4, Math.ceil(arMetrics.actualBoundingBoxDescent))
      const subY = arBottom + 10
      c.font = '600 9px "JetBrains Mono"'
      const SW = Math.ceil(Math.max(arMetrics.width, c.measureText(line2).width)) + 16, SH = subY + 4
      src.width = SW
      src.height = SH
      c.fillStyle = '#fff'
      c.textAlign = 'center'
      c.font = font1
      c.direction = rtl ? 'rtl' : 'ltr'
      c.fillText(line1, SW / 2, 30)
      c.font = '600 9px "JetBrains Mono"'
      c.direction = 'ltr'
      c.fillText(line2, SW / 2, subY)
      const img = c.getImageData(0, 0, SW, SH).data

      const targets: { x: number; y: number; line: 0 | 1 }[] = []
      let minX = SW, maxX = 0, minY = SH, maxY = 0
      for (let y = 0; y < SH; y++)
        for (let x = 0; x < SW; x++)
          if (img[(y * SW + x) * 4 + 3] > 110) {
            targets.push({ x, y, line: y > arBottom ? 1 : 0 })
            minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
          }
      if (!targets.length) return

      // 2. Size the display canvas: P screen px per text pixel, padding for sparkles
      const pad = 6
      const bw = maxX - minX + 1 + pad * 2, bh = maxY - minY + 1 + pad * 2
      const fit = maxWidth ? Math.floor(maxWidth / bw) : Infinity
      const P = Math.max(1, Math.min(Math.max(2, Math.round((window.innerHeight / 270) * scale)), fit))
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(bw * P * dpr)
      canvas.height = Math.round(bh * P * dpr)
      canvas.style.width = `${bw * P}px`
      canvas.style.height = `${bh * P}px`
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)

      const parts = targets.map((t, i) => {
        const tx = t.x - minX + pad, ty = t.y - minY + pad
        return {
          tx, ty, line: t.line,
          sx: bw / 2 + (hash(i, 1) - 0.5) * bw * 1.4,
          sy: -bh * (0.3 + hash(i, 2)),
          delay: t.line === 0 ? ((rtl ? bw - tx : tx) / bw) * 1.1 + hash(i, 3) * 0.35 : 1.5 + (tx / bw) * 0.6 + hash(i, 4) * 0.2,
        }
      })
      const sparkles = Array.from({ length: 16 }, (_, i) => ({
        x: Math.floor(hash(i, 11) * bw), y: Math.floor(hash(i, 12) * bh), ph: hash(i, 13) * 6, sp: 1 + hash(i, 14) * 2,
      }))

      const start = performance.now()
      let last = 0
      const easeOut = (k: number) => 1 - Math.pow(1 - k, 3)

      const frame = (nowMs: number) => {
        raf = requestAnimationFrame(frame)
        const t = (nowMs - start) / 1000
        const assembled = t > 3.4
        if (nowMs - last < (assembled ? 66 : 33)) return // ~30fps while flying, ~15fps after
        last = nowMs
        ctx.clearRect(0, 0, bw * P, bh * P)

        for (const s of sparkles) {
          const v = Math.sin(t * s.sp + s.ph)
          if (!assembled || v < 0.8) continue
          ctx.fillStyle = v > 0.95 ? '#ffffff' : '#f6d27a'
          ctx.fillRect(s.x * P, s.y * P, P, P)
        }

        // Pixel drop shadow for settled pixels, then the pixels themselves
        ctx.fillStyle = 'rgba(20, 12, 30, 0.45)'
        for (const p of parts) if (t - p.delay > 1.1) ctx.fillRect((p.tx + 1) * P, (p.ty + 1) * P, P, P)

        for (const p of parts) {
          const k = Math.min(1, Math.max(0, (t - p.delay) / 1.1))
          if (k <= 0) continue
          const e = easeOut(k)
          const x = p.sx + (p.tx - p.sx) * e
          const y = p.sy + (p.ty - p.sy) * e - Math.sin(k * Math.PI) * 6
          if (k < 1) {
            ctx.fillStyle = k < 0.7 ? '#fff8e0' : GOLD[4]
          } else {
            // Light sweeping diagonally across the settled text
            const sweep = Math.sin((p.tx + p.ty * 0.7) * 0.18 - t * 2.2)
            const ramp = p.line === 0 ? GOLD : CREAM
            const idx = Math.max(0, Math.min(ramp.length - 1, Math.round((sweep * 0.5 + 0.5) * (ramp.length - 1) + (p.line === 0 ? 0.4 : 0))))
            ctx.fillStyle = ramp[idx]
          }
          ctx.fillRect(Math.round(x) * P, Math.round(y) * P, P, P)
        }
      }
      raf = requestAnimationFrame(frame)
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  })
</script>

<div class="wrap" class:boxed in:fade={{ duration: 400 }} out:fade={{ duration: 800 }}>
  {#if boxed}<span class="ornament" aria-hidden="true">۞</span>{/if}
  <canvas bind:this={canvas} class="banner" aria-label={label}></canvas>
</div>

<style>
  .wrap { position: relative; }
  /* Unboxed (under the verse): a soft dark glow so the text reads over bright scenery */
  .wrap:not(.boxed) {
    padding: 0.4rem 1.2rem;
    background: radial-gradient(ellipse at center, color-mix(in srgb, var(--bg) 55%, transparent) 20%, transparent 72%);
  }
  /* Same frosted box as the verse, for when it stands in the verse's place */
  .boxed {
    padding: 1.3rem 2.2rem 1rem;
    background: color-mix(in srgb, var(--bg) 68%, transparent);
    backdrop-filter: blur(4px);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--bg) 25%, transparent), 0 8px 32px color-mix(in srgb, var(--bg) 50%, transparent);
  }
  .ornament {
    position: absolute; top: 0; left: 50%; transform: translate(-50%, -55%);
    padding: 0 0.6rem; font-family: var(--font-arabic); font-size: 1.4rem; line-height: 1;
    color: var(--accent); background: color-mix(in srgb, var(--bg) 92%, transparent);
  }
  .banner {
    display: block;
    image-rendering: pixelated;
    filter: drop-shadow(0 0 0.5rem rgba(255, 196, 110, 0.45));
  }
</style>
