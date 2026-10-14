#!/usr/bin/env node
// Sandbox capture: records one scene from the SANDBOX dashboard (port 8090) to lab/out/<name>.mp4.
// Same idea as omarchy/render-wallpaper-videos.mjs --clean, but headless so no window pops up.
//   node capture.mjs <prayer> [seconds]
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '../dashboard-sandbox/package.json'))
const puppeteer = require('puppeteer-core')

const prayer = process.argv[2] ?? 'maghrib'
const SECONDS = Number(process.argv[3] ?? 20)
const FPS = 20
const BASE_URL = process.env.DASHBOARD_URL ?? 'http://127.0.0.1:8090'
const outFile = path.join(here, 'out', `${prayer}.mp4`)

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,1080'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.goto(`${BASE_URL}/?prayer=${prayer}`, { waitUntil: 'load' })
await page.addStyleTag({
  content: `.area.top-left, .area.top-right, .area.top-center figure, .area.top-center .wrap { display: none !important; }`,
})
await new Promise((r) => setTimeout(r, 3000))
await page.screenshot({ path: path.join(here, 'out', `${prayer}-still.png`) })

const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', outFile], { stdio: ['pipe', 'inherit', 'inherit'] })
const done = new Promise((res, rej) => ffmpeg.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`)))))

const total = SECONDS * FPS
const start = Date.now()
for (let i = 0; i < total; i++) {
  const frame = await page.screenshot({ type: 'jpeg', quality: 90 })
  if (!ffmpeg.stdin.write(frame)) await new Promise((r) => ffmpeg.stdin.once('drain', r))
  const wait = start + (i + 1) * (1000 / FPS) - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}
ffmpeg.stdin.end()
await done
await browser.close()
const took = (Date.now() - start) / 1000
console.log(`${outFile}: ${total} frames, capture took ${took.toFixed(1)} s for ${SECONDS} s of video (x${(took / SECONDS).toFixed(2)})`)
