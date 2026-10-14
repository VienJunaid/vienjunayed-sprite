import { CELL_ASPECT } from './ascii'

/** Palette keys used in pixel-art assets ("." is transparent). */
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*+=?@'

/** Pixel rows for a given width: each text cell holds two pixels stacked vertically. */
export const pixelRowsFor = (width: number, height: number, cols: number) =>
  Math.max(1, Math.round(((cols * height) / width) * CELL_ASPECT * 2))

export interface PixelArt {
  palette: Record<string, string>
  frames: string[][]
}

const scratch = document.createElement('canvas')

function sample(src: CanvasImageSource, cols: number, rows: number): Uint8ClampedArray {
  scratch.width = cols
  scratch.height = rows
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, cols, rows)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, cols, rows)
  return ctx.getImageData(0, 0, cols, rows).data
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

/**
 * Downscale frames to `cols` pixels wide and reduce to at most `maxColors` colors
 * (popularity quantization shared across frames, so animation colors stay stable).
 */
export function imageToPixelArt(
  frames: CanvasImageSource[], width: number, height: number,
  opts: { cols: number; maxColors?: number; transparent?: boolean },
): PixelArt {
  const cols = Math.max(1, Math.round(opts.cols))
  const rows = pixelRowsFor(width, height, cols)
  const maxColors = Math.min(KEYS.length, opts.maxColors ?? 24)
  const data = frames.map((f) => sample(f, cols, rows))

  // Count colors in 5-bit buckets
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (const px of data)
    for (let i = 0; i < px.length; i += 4) {
      if (opts.transparent && px[i + 3] < 128) continue
      const key = ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3)
      const c = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
      c.n++; c.r += px[i]; c.g += px[i + 1]; c.b += px[i + 2]
      counts.set(key, c)
    }

  // Most common first, skipping near-duplicates
  const picked: [number, number, number][] = []
  const sorted = [...counts.values()].sort((a, b) => b.n - a.n)
  for (const minDist of [40, 24, 12, 0]) {
    for (const c of sorted) {
      if (picked.length >= maxColors) break
      const rgb: [number, number, number] = [Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)]
      if (picked.every((p) => Math.hypot(p[0] - rgb[0], p[1] - rgb[1], p[2] - rgb[2]) > minDist)) picked.push(rgb)
    }
    if (picked.length >= maxColors) break
  }

  const palette: Record<string, string> = {}
  picked.forEach((p, i) => (palette[KEYS[i]] = hex(...p)))
  const nearest = (r: number, g: number, b: number) => {
    let best = 0, bestD = Infinity
    picked.forEach((p, i) => {
      const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2
      if (d < bestD) { bestD = d; best = i }
    })
    return KEYS[best]
  }

  return {
    palette,
    frames: data.map((px) =>
      Array.from({ length: rows }, (_, y) => {
        let line = ''
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4
          line += opts.transparent && px[i + 3] < 128 ? '.' : nearest(px[i], px[i + 1], px[i + 2])
        }
        return line
      }),
    ),
  }
}
