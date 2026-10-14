// One still of a sandbox scene in scenery mode: node still.mjs <scene> <out.png>
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const puppeteer = createRequire(path.join(here, '../dashboard-sandbox/package.json'))('puppeteer-core')
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,1080'] })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.goto(`http://127.0.0.1:8090/?scene=${process.argv[2]}`, { waitUntil: 'load' })
await page.addStyleTag({ content: `.exit-scenery { display: none !important; }` })
await new Promise((r) => setTimeout(r, 4000))
await page.screenshot({ path: process.argv[3] })
await browser.close()
