#!/usr/bin/env node
// Renders each prayer scene to a looping MP4 for the mpvpaper live wallpaper (see
// docs/omarchy.md step 6 and docs/wallpaper-crash-log.md). Run manually, with `npm start`
// already up: `npm run render-wallpaper-videos` (bannered, the default) or
// `npm run render-wallpaper-videos -- --clean` (no banner, for the manual background picker -
// see omarchy/wallpaper-swap.mjs's --pin).
//
// Bannered (default): captures `?prayer=<name>&banner`, which forces the PixelTitle "prayer
// just started" fly-in via forceBanner, with the clock/Salah/verse boxes hidden via injected
// CSS so only the scene + banner animation show. PixelTitle keeps animating indefinitely once
// mounted (a gold sweep + sparkles - see apps/web/src/components/PixelTitle.svelte), so it
// stays visible for the whole clip, not just the ~3.4s fly-in. Used for the automatic
// real-time wallpaper swap, where "just started" is factually true.
//
// --clean: captures `?prayer=<name>` (no &banner), so the banner only shows if it happens to
// really be that prayer's first 12 minutes - reliably absent otherwise. Used when someone
// manually picks a prayer's scene to look at, where it isn't actually "just starting".

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLEAN = process.argv.includes('--clean')
const OUT_DIR = path.join(__dirname, CLEAN ? 'wallpaper-videos-clean' : 'wallpaper-videos')

const BASE_URL = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:8080'
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable'
const WIDTH = Number(process.env.WALLPAPER_WIDTH ?? 1920)
const HEIGHT = Number(process.env.WALLPAPER_HEIGHT ?? 1080)
const FPS = Number(process.env.WALLPAPER_FPS ?? 20) // matches config/dashboard.json fps
const SECONDS = Number(process.env.WALLPAPER_SECONDS ?? 60)

// Prayer -> scene mapping, from CLAUDE.md's prayer/scene table.
const SCENES = {
  fajr: 'aqsa-fajr',
  dhuhr: 'kaaba-dhuhr',
  asr: 'sophia-asr',
  maghrib: 'madinah-maghrib',
  isha: 'farooq-isha',
}

async function renderScene(browser, prayer, scene) {
  const outFile = path.join(OUT_DIR, `${prayer}.mp4`)
  console.log(`[${prayer}] rendering ${scene}${CLEAN ? '' : ' + banner'} -> ${outFile}`)

  const page = await browser.newPage()
  await page.setViewport({ width: WIDTH, height: HEIGHT })
  // &banner forces justStarted (PixelTitle "TIME FOR <PRAYER>") regardless of real time.
  // Not networkidle0: the app holds an open SSE connection (live reload) that never goes idle.
  const url = CLEAN ? `${BASE_URL}/?prayer=${prayer}` : `${BASE_URL}/?prayer=${prayer}&banner`
  await page.goto(url, { waitUntil: 'load' })
  // Hide clock (top-left) and Salah (top-right); within top-center, hide the verse figure but
  // keep the PixelTitle banner canvas (bannered mode only - see below).
  //
  // --clean also hides PixelTitle's wrapper (`.wrap`, in components/PixelTitle.svelte). Dropping
  // &banner above only stops the forced "TIME FOR <PRAYER>" fly-in (justStarted) - it does NOT
  // stop this project's dashboard.json `prayer.showCurrent: true` setting, which independently
  // keeps a PixelTitle banner ("<PRAYER> · <time>") up for the whole period regardless of
  // justStarted. With a forced `?prayer=` preview, that banner's time is page-load time, not the
  // real prayer start - baking in whatever moment this script happened to run. Must hide the
  // element outright for a genuinely clean capture.
  await page.addStyleTag({
    content: `
      .area.top-left, .area.top-right { display: none !important; }
      .area.top-center figure { display: none !important; }
      ${CLEAN ? '.area.top-center .wrap { display: none !important; }' : ''}
    `,
  })
  // Let the scene + banner settle (transition-in) before capturing - short enough we don't miss
  // the start of the fly-in.
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
  else ffmpeg.stderr.on('data', () => {}) // silence ffmpeg's verbose progress output

  const totalFrames = SECONDS * FPS
  const intervalMs = 1000 / FPS
  for (let i = 0; i < totalFrames; i++) {
    const frame = await page.screenshot({ type: 'jpeg', quality: 90 })
    if (!ffmpeg.stdin.write(frame)) {
      await new Promise((r) => ffmpeg.stdin.once('drain', r))
    }
    if (i % (FPS * 5) === 0) console.log(`[${prayer}] frame ${i}/${totalFrames}`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  ffmpeg.stdin.end()
  await ffmpegDone
  await page.close()
  console.log(`[${prayer}] done`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  // Not headless + swiftshader: that forces software rendering, which was ~325% CPU and on pace
  // to take hours for 5 scenes. This machine has working GPU acceleration (the live dashboard
  // window proves it) - launch a real (visible, briefly) Wayland window instead so it composites
  // on the GPU like everything else does.
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
    for (const [prayer, scene] of Object.entries(SCENES)) {
      await renderScene(browser, prayer, scene)
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
