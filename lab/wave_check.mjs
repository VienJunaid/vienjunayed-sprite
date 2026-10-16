// Checks tap-to-wave in the sandbox: click the man, the couple wave, then return to idle.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const puppeteer = createRequire(path.join(here, '../dashboard-sandbox/package.json'))('puppeteer-core')
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1366,768'] })
const page = await browser.newPage()
await page.setViewport({ width: 1366, height: 768 })
await page.goto('http://127.0.0.1:8090/?prayer=maghrib', { waitUntil: 'load' })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const clip = { x: 483, y: 368, width: 400, height: 400 }
const shot = (name) => page.screenshot({ path: path.join(here, 'out', `wavecheck-${name}.png`), clip })
await wait(4000)
await shot('1-before')
await page.mouse.click(640, 600)                       // on the man
await wait(1300); await shot('2-him-waving')
await wait(900);  await shot('3-both-waving')
await wait(4500); await shot('4-after')
console.log('page after click:', await page.evaluate(() => sessionStorage.getItem('dashboard:page')))
await page.mouse.click(300, 300); await wait(1500); await shot('5-click-on-sky')
await browser.close()
