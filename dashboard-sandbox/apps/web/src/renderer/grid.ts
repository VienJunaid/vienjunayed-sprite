/**
 * The frame buffer: per cell a glyph id, a foreground color id and a background color id.
 * Glyph 0 is "empty"; color 0 is the theme background.
 */
export class Grid {
  glyphs: Uint8Array
  /** Color ids are 12-bit (up to 4096 colors shared by all pages). */
  colors: Uint16Array
  bgs: Uint16Array

  constructor(public cols: number, public rows: number) {
    this.glyphs = new Uint8Array(cols * rows)
    this.colors = new Uint16Array(cols * rows)
    this.bgs = new Uint16Array(cols * rows)
  }

  /** Empty every cell, filled with background color `bg`. */
  clear(bg = 0) {
    this.glyphs.fill(0)
    this.colors.fill(0)
    this.bgs.fill(bg)
  }

  /** Set glyph + foreground; keeps the cell's background (so text can sit on pixel art). */
  set(x: number, y: number, glyph: number, color: number) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return
    const i = y * this.cols + x
    this.glyphs[i] = glyph
    this.colors[i] = color
  }

  setCell(x: number, y: number, glyph: number, color: number, bg: number) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return
    const i = y * this.cols + x
    this.glyphs[i] = glyph
    this.colors[i] = color
    this.bgs[i] = bg
  }
}
