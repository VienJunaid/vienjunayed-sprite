import type { BackgroundAsset, CharacterAsset, SceneConfig, Theme } from '../lib/types'
import { GlyphSet, Palette } from '../renderer/glyphs'
import type { Grid } from '../renderer/grid'
import { createBackground } from './backgrounds'
import { createSprite } from './characters'
import { PixelLayer } from './pixels'
import type { SceneContext } from './types'

export interface SceneAssets {
  background?: BackgroundAsset
  characters: Map<string, CharacterAsset>
}

/** Everything needed to render one page's scene. */
export interface LoadedPage {
  scene: SceneConfig
  theme: Theme
  assets: SceneAssets
}

/**
 * Composes each frame:
 *   background → pixel-art sprites → fold pixels into cells → ASCII sprites → overlay
 * so ASCII text can sit on top of pixel art (it keeps the cell's background color).
 */
export function createScene(
  scene: SceneConfig,
  theme: Theme,
  assets: SceneAssets,
  // Scenes on different pages share glyph + color ids so they can be blended in transitions.
  shared: { glyphs: GlyphSet; palette: Palette } = { glyphs: new GlyphSet(), palette: new Palette(theme.background) },
) {
  const ctx: SceneContext = { ...shared, theme }
  const bg = ctx.palette.id(theme.background)
  const pixels = new PixelLayer(ctx.glyphs)
  const background = createBackground(ctx, assets.background, assets.characters)
  const sprites = scene.characters.flatMap((cfg) => {
    if (cfg.hidden) return [] // loaded for the background effect to draw itself
    const asset = assets.characters.get(cfg.asset)
    if (!asset) {
      console.warn(`Character "${cfg.asset}" not found in assets/characters/`)
      return []
    }
    return [createSprite(ctx, asset, cfg)]
  })
  const pixelSprites = sprites.filter((s) => s.kind === 'pixel')
  const asciiSprites = sprites.filter((s) => s.kind === 'ascii')

  return {
    glyphs: ctx.glyphs,
    palette: ctx.palette,
    draw(grid: Grid, t: number) {
      grid.clear(bg)
      pixels.resize(grid.cols, grid.rows)
      pixels.clear()
      background.draw(grid, t, pixels)
      for (const s of pixelSprites) s.draw(grid, t, pixels)
      pixels.resolve(grid)
      for (const s of asciiSprites) s.draw(grid, t, pixels)
      background.overlay?.(grid, t)
    },
    /**
     * A tap at pixel-layer (x, y), scene time t. On a figure that can wave: it waves, and anyone
     * else in the scene who can waves back a beat later. Returns whether a figure was hit.
     */
    tap(x: number, y: number, t: number) {
      const wavers = pixelSprites.filter((s) => s.play)
      const hit = wavers.find((s) => s.hit?.(x, y))
      if (!hit?.play?.('wave', t)) return false
      for (const s of wavers) if (s !== hit) s.play?.('wave', t + 0.5)
      return true
    },
  }
}
