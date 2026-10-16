// Checks the Horse journey row in the REAL dashboard (run on a temporary port): node real_check.mjs <port>
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const puppeteer = createRequire(path.join(here, '../dashboard-sandbox/package.json'))('puppeteer-core')
const base = `http://127.0.0.1:${process.argv[2]}`
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1920,1080'] })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
page.on('console', (m) => { if (m.type() === 'error') console.log('  page error:', m.text().slice(0, 200)) })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const open = async () => { await page.waitForSelector('button[aria-label="Open settings"]'); await wait(2500); await page.click('button[aria-label="Open settings"]'); await wait(700) }
const choice = (i) => page.evaluate((i) => document.querySelectorAll('.settings .choices button')[i].click(), i)
const labels = () => page.evaluate(() => [...document.querySelectorAll('.settings .choices button')].map((b) => b.textContent.trim()))
const override = async () => (await (await fetch(`${base}/api/config`)).json()).pages[0].sceneOverride ?? '(none)'
const shot = (n) => page.screenshot({ path: path.join(here, 'out', `real-${n}.png`) })

await page.goto(base, { waitUntil: 'load' })
await open()
console.log('row buttons:', await labels(), '| home override:', await override())
await shot('1-settings')
await choice(0); await wait(4000)
console.log('scenery option -> scenery mode:', await page.evaluate(() => !!document.querySelector('.exit-scenery')), '| widgets hidden:', await page.evaluate(() => !document.querySelector('.widgets')))
await shot('2-scenery')
await page.goto(base, { waitUntil: 'load' })
await open(); await choice(1); await wait(9000)          // saves, the page reloads itself
console.log('as home -> override:', await override())
await page.waitForSelector('button[aria-label="Open settings"]'); await wait(4000)
await shot('3-home')
await open()
console.log('row buttons now:', await labels())
await choice(1); await wait(9000)
console.log('toggled back -> override:', await override())
await browser.close()
