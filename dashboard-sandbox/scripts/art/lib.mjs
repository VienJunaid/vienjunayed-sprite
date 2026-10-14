// Tiny pixel-art toolkit used by the generators in this folder.
// A canvas holds single-character palette keys; "." is transparent.
import { writeFileSync } from 'node:fs'

export class Pix {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.d = Array.from({ length: h }, () => Array(w).fill('.'))
  }

  set(x, y, k) {
    x = Math.round(x)
    y = Math.round(y)
    if (k && x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y][x] = k
  }

  get(x, y) {
    return this.d[y]?.[x] ?? '.'
  }

  /** Fill an inclusive rect. `k` is a key or (x, y) => key. */
  rect(x0, y0, x1, y1, k) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, typeof k === 'function' ? k(x, y) : k)
  }

  /** Horizontal span centered on cx with half-width hw. */
  span(y, cx, hw, k) {
    this.rect(cx - hw, y, cx + hw, y, k)
  }

  clone() {
    const p = new Pix(this.w, this.h)
    p.d = this.d.map((r) => [...r])
    return p
  }

  rows() {
    return this.d.map((r) => r.join(''))
  }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)]

export const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Pick from `keys` (dark → light) by a 0–1 light value, with ordered dithering at the seams. */
export const shade = (keys, light, x, y, spread = 0.12) => {
  const v = Math.min(0.999, Math.max(0, light + (bayer(x, y) - 0.5) * spread))
  return keys[Math.floor(v * keys.length)]
}

export function save(name, { palette, frames, fps = 1 }) {
  const file = new URL(`../../assets/characters/${name}.json`, import.meta.url)
  const body = { name, fps, palette, frames: frames.map((f) => f.rows()) }
  writeFileSync(file, JSON.stringify(body, null, 1) + '\n')
  console.log(`  ${name.padEnd(20)} ${frames[0].w}×${frames[0].h}px, ${frames.length} frame(s)`)
}
