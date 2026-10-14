import { createCanvas2DRenderer } from './canvas2d'
import { createWebGLRenderer } from './webgl'
import type { Renderer } from './types'

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const forced = new URLSearchParams(location.search).get('renderer')
  if (forced !== 'canvas2d') {
    try {
      const r = createWebGLRenderer(canvas)
      if (r) return r
    } catch (err) {
      console.warn('WebGL2 renderer failed, falling back to Canvas 2D', err)
    }
  }
  return createCanvas2DRenderer(canvas)
}

export { Grid } from './grid'
export { GlyphSet, Palette } from './glyphs'
export type { Renderer } from './types'
