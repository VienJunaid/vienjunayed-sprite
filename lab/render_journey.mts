// Renders one full loop of the journey scene straight to a video, with no browser: the scene is a
// pure function of time, so each frame is drawn at an exact time and written out. One art pixel
// becomes 10 x 9 screen pixels, exactly as the dashboard shows it at 1080p (192 x 120 -> 1920 x 1080).
//   ../dashboard-sandbox/node_modules/.bin/tsx render_journey.mts [out.mp4]
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CharacterAsset } from '../dashboard-sandbox/apps/web/src/lib/types'
import { GlyphSet, Palette } from '../dashboard-sandbox/apps/web/src/renderer/glyphs'
import { Grid } from '../dashboard-sandbox/apps/web/src/renderer/grid'
import { journey } from '../dashboard-sandbox/apps/web/src/scene/backgrounds/journey'
import { PixelLayer } from '../dashboard-sandbox/apps/web/src/scene/pixels'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '../dashboard-sandbox')
const json = (p: string) => JSON.parse(readFileSync(path.join(root, p), 'utf8'))

const scene = json('config/scenes/journey.json')
const theme = json(`config/themes/${scene.theme}.json`)
const params = json(`assets/backgrounds/${scene.background}.json`).params
const characters = new Map<string, CharacterAsset>(scene.characters.map((c: { asset: string }) => [c.asset, json(`assets/characters/${c.asset}.json`)]))

const FPS = 20, COLS = 192, ROWS = 60
const W = COLS, H = ROWS * 2
const T = (params.stopSeconds ?? 30) * 4
const frames = T * FPS
const out = process.argv[2] ?? path.join(here, 'out', 'journey.mp4')

const glyphs = new GlyphSet(), palette = new Palette(theme.background)
const bg = journey({ glyphs, palette, theme }, params, characters)
const px = new PixelLayer(glyphs)
px.resize(COLS, ROWS)
const grid = new Grid(COLS, ROWS)

function frame(t: number) {
  px.clear()
  bg.draw(grid, t, px)
  const rgb = Buffer.alloc(W * H * 3)
  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = palette.colors[px.data[i]]
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b
  }
  return rgb
}

// The loop must close: the frame one full loop later has to be the first frame again.
const first = frame(0), again = frame(T)
let differ = 0
for (let i = 0; i < W * H; i++) if (first[i * 3] !== again[i * 3] || first[i * 3 + 1] !== again[i * 3 + 1] || first[i * 3 + 2] !== again[i * 3 + 2]) differ++
console.log(`loop check: frame at ${T} s vs frame at 0 s -> ${differ} of ${W * H} pixels differ`)
const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
  '-vf', 'scale=1920:1080:flags=neighbor', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] })
const done = new Promise<void>((res, rej) => ffmpeg.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))))
const started = Date.now()
for (let i = 0; i < frames; i++) {
  if (!ffmpeg.stdin.write(frame(i / FPS))) await new Promise((r) => ffmpeg.stdin.once('drain', r))
}
ffmpeg.stdin.end()
await done
console.log(`${out}: ${frames} frames, ${T} s at ${FPS} fps, rendered in ${((Date.now() - started) / 1000).toFixed(0)} s`)
