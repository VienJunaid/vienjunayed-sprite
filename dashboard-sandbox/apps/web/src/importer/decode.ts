import { decompressFrames, parseGIF } from 'gifuct-js'

export interface Decoded {
  width: number
  height: number
  /** Full composited frames. */
  frames: HTMLCanvasElement[]
  /** Suggested playback rate from the GIF's frame delays. */
  fps: number
}

const MAX_FRAMES = 120

/** Decode a GIF (all frames, properly composited) or a still image (one frame). */
export async function decodeFile(file: File): Promise<Decoded> {
  if (file.type === 'image/gif') return decodeGif(await file.arrayBuffer())
  const bitmap = await createImageBitmap(file)
  const c = document.createElement('canvas')
  c.width = bitmap.width
  c.height = bitmap.height
  c.getContext('2d')!.drawImage(bitmap, 0, 0)
  return { width: c.width, height: c.height, frames: [c], fps: 1 }
}

function decodeGif(buffer: ArrayBuffer): Decoded {
  const gif = parseGIF(buffer)
  const raw = decompressFrames(gif, true)
  const { width, height } = gif.lsd

  const composite = document.createElement('canvas')
  composite.width = width
  composite.height = height
  const ctx = composite.getContext('2d')!
  const patch = document.createElement('canvas')
  const pctx = patch.getContext('2d')!

  const step = Math.max(1, Math.ceil(raw.length / MAX_FRAMES))
  const frames: HTMLCanvasElement[] = []
  let prev: (typeof raw)[number] | undefined

  raw.forEach((f, i) => {
    if (prev?.disposalType === 2) ctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height)
    patch.width = f.dims.width
    patch.height = f.dims.height
    pctx.putImageData(new ImageData(new Uint8ClampedArray(f.patch), f.dims.width, f.dims.height), 0, 0)
    ctx.drawImage(patch, f.dims.left, f.dims.top)
    prev = f
    if (i % step) return
    const copy = document.createElement('canvas')
    copy.width = width
    copy.height = height
    copy.getContext('2d')!.drawImage(composite, 0, 0)
    frames.push(copy)
  })

  const avgDelay = raw.reduce((s, f) => s + (f.delay || 100), 0) / raw.length
  return { width, height, frames, fps: Math.round(Math.min(30, 1000 / (avgDelay * step)) * 10) / 10 }
}
