import type { GlyphSet } from '../renderer/glyphs'
import type { Grid } from '../renderer/grid'

/**
 * A color canvas at 2× the grid's vertical resolution. Each text cell shows two stacked
 * "pixels" using the half-block trick: glyph ▀ with fg = top pixel and bg = bottom pixel.
 * With ~10×18px cells that gives near-square pixels — classic terminal pixel art.
 * Values are palette ids; 0 = transparent (whatever the grid already has shows through).
 */
export class PixelLayer {
  w = 0
  h = 0
  data = new Uint16Array(0)
  private upper = 0
  private lower = 0

  constructor(glyphs: GlyphSet) {
    this.upper = glyphs.id('▀')
    this.lower = glyphs.id('▄')
  }

  resize(cols: number, rows: number) {
    if (cols === this.w && rows * 2 === this.h) return false
    this.w = cols
    this.h = rows * 2
    this.data = new Uint16Array(this.w * this.h)
    return true
  }

  clear() {
    this.data.fill(0)
  }

  set(x: number, y: number, color: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !color) return
    this.data[y * this.w + x] = color
  }

  /** Fold pixel pairs into grid cells. */
  resolve(grid: Grid) {
    const { w, data } = this
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const top = data[2 * y * w + x]
        const bottom = data[(2 * y + 1) * w + x]
        if (!top && !bottom) continue
        const i = y * grid.cols + x
        if (top === bottom) grid.setCell(x, y, 0, 0, top)
        else if (top && bottom) grid.setCell(x, y, this.upper, top, bottom)
        else if (top) grid.setCell(x, y, this.upper, top, grid.bgs[i])
        else grid.setCell(x, y, this.lower, bottom, grid.bgs[i])
      }
    }
  }
}

/** 4×4 ordered-dither threshold in [0, 1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]

/** Cheap deterministic hash → [0, 1) */
export const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
