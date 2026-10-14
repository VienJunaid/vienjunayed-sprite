/** Width ÷ height of one terminal cell. Used to keep images from looking stretched. */
export const CELL_ASPECT = 0.55

export interface AsciiOptions {
  cols: number
  /** Defaults to the image aspect ratio corrected for cell shape. */
  rows?: number
  /** Characters dark → bright. */
  ramp?: string
  invert?: boolean
  /** Pixels with alpha below this (0–255) become spaces. Used for characters/sprites. */
  alphaThreshold?: number
  /** Stretch contrast so the full ramp is used. */
  normalize?: boolean
}

const scratch = document.createElement('canvas')

export function rowsFor(width: number, height: number, cols: number) {
  return Math.max(1, Math.round(((cols * height) / width) * CELL_ASPECT))
}

/** Convert an image (or a canvas holding a GIF frame) to rows of ASCII text. */
export function imageToAscii(src: CanvasImageSource, width: number, height: number, opts: AsciiOptions): string[] {
  const cols = Math.max(1, Math.round(opts.cols))
  const rows = opts.rows ?? rowsFor(width, height, cols)
  const ramp = Array.from(opts.ramp ?? ' .:-=+*#%@')
  const threshold = opts.alphaThreshold ?? -1

  scratch.width = cols
  scratch.height = rows
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, cols, rows)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, cols, rows)
  const px = ctx.getImageData(0, 0, cols, rows).data

  const lum = new Float32Array(cols * rows)
  let lo = 1, hi = 0
  for (let i = 0; i < cols * rows; i++) {
    const a = px[i * 4 + 3]
    if (a <= threshold) { lum[i] = -1; continue }
    const l = ((0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255) * (threshold < 0 ? a / 255 : 1)
    lum[i] = l
    lo = Math.min(lo, l)
    hi = Math.max(hi, l)
  }

  const range = opts.normalize !== false && hi > lo ? hi - lo : 1
  const base = opts.normalize !== false && hi > lo ? lo : 0
  const out: string[] = []
  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < cols; x++) {
      const l = lum[y * cols + x]
      if (l < 0) { line += ' '; continue }
      let v = (l - base) / range
      if (opts.invert) v = 1 - v
      line += ramp[Math.min(ramp.length - 1, Math.round(v * (ramp.length - 1)))]
    }
    out.push(line.trimEnd())
  }
  return out
}
