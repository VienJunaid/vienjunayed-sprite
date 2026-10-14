import type { GlyphSet, Palette } from './glyphs'
import type { Grid } from './grid'

export interface Renderer {
  readonly kind: 'webgl2' | 'canvas2d'
  /** The graphics chip doing the drawing, e.g. "V3D 7.1" on a Pi 5, or "SwiftShader"/"llvmpipe"
   * when the browser fell back to software (slow and hot). */
  readonly gpu?: string
  /** Cell size in device pixels. */
  resize(cols: number, rows: number, cellW: number, cellH: number): void
  draw(grid: Grid, glyphs: GlyphSet, palette: Palette): void
  destroy(): void
}
