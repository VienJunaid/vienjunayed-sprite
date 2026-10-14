import type { Grid } from '../renderer/grid'
import type { GlyphSet, Palette } from '../renderer/glyphs'
import type { Theme } from '../lib/types'
import type { PixelLayer } from './pixels'

export interface SceneContext {
  glyphs: GlyphSet
  palette: Palette
  theme: Theme
}

export interface Background {
  /** Fraction of the screen height where sky meets water (for reflections). */
  horizon?: number
  /** Draw into the ASCII grid and/or the pixel layer. */
  draw(grid: Grid, t: number, pixels: PixelLayer): void
  /** Optional pass drawn after all sprites (e.g. ASCII sparkles over everything). */
  overlay?(grid: Grid, t: number): void
}
