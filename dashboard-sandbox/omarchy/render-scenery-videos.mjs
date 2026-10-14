#!/usr/bin/env node
// Renders non-prayer scenery scenes (config/scenes/*.json that aren't one of the five prayer
// scenes - see render-wallpaper-videos.mjs for those) to looping MP4s for the mpvpaper live
// wallpaper, same pipeline as render-wallpaper-videos.mjs --clean but hitting scenery mode
// (`?scene=<name>`, see CLAUDE.md's URL param table) instead of `?prayer=<name>`.
//
// Output goes straight into wallpaper-videos-clean/ (the same dir wallpaper-swap.mjs's
// VIDEO_DIR_CLEAN reads from), named by scene, e.g. haram-aerial.mp4.
//
// Run manually, with `npm start` already up: `node omarchy/render-scenery-videos.mjs`

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'wallpaper-videos-clean')

const BASE_URL = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:8080'
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable'
const WIDTH = Number(process.env.WALLPAPER_WIDTH ?? 1920)
const HEIGHT = Number(process.env.WALLPAPER_HEIGHT ?? 1080)
const FPS = Number(process.env.WALLPAPER_FPS ?? 20)
const SECONDS = Number(process.env.WALLPAPER_SECONDS ?? 60)

// Scenery-only scenes from config/scenes/, excluding the five prayer scenes already handled by
// render-wallpaper-videos.mjs.
const SCENES = (process.argv.slice(2).filter((a) => !a.startsWith('--')).length
  ? process.argv.slice(2).filter((a) => !a.startsWith('--'))
  : ['aqsa-sunset', 'farooq-wedding', 'haram-aerial', 'kazakh-meadow', 'madinah', 'night-mosque']
)

async function renderScene(browser, scene) {
  const outFile = path.join(OUT_DIR, `${scene}.mp4`)
  console.log(`[${scene}] rendering -> ${outFile}`)

  const page = await browser.newPage()
  await page.setViewport({ width: WIDTH, height: HEIGHT })
  const url = `${BASE_URL}/?scene=${scene}`
  await page.goto(url, { waitUntil: 'load' })
  // Scenery mode already hides every widget - just the exit-scenery ✕ button remains.
  await page.addStyleTag({ content: `.exit-scenery { display: none !important; }` })
  await new Promise((r) => setTimeout(r, 1200))

  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-framerate', String(FPS),
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    outFile,
  ])
  const ffmpegDone = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject)
    ffmpeg.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))))
  })
  if (process.env.DEBUG_FFMPEG) ffmpeg.stderr.on('data', (d) => process.stderr.write(d))
  else ffmpeg.stderr.on('data', () => {})

  const totalFrames = SECONDS * FPS
  const intervalMs = 1000 / FPS
  for (let i = 0; i < totalFrames; i++) {
    const frame = await page.screenshot({ type: 'jpeg', quality: 90 })
    if (!ffmpeg.stdin.write(frame)) {
      await new Promise((r) => ffmpeg.stdin.once('drain', r))
    }
    if (i % (FPS * 5) === 0) console.log(`[${scene}] frame ${i}/${totalFrames}`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  ffmpeg.stdin.end()
  await ffmpegDone
  await page.close()
  console.log(`[${scene}] done`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    dumpio: true,
    args: [
      '--ozone-platform=wayland',
      `--window-size=${WIDTH},${HEIGHT}`,
    ],
  })

  try {
    for (const scene of SCENES) {
      await renderScene(browser, scene)
    }
  } finally {
    await browser.close()
  }

  console.log(`All scenes rendered to ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
